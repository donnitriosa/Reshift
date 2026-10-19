from __future__ import annotations

import io
import os
import shutil
import zipfile
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.background import BackgroundTask

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from utils.image_processor import process_image, MAX_FILE_BYTES, SUPPORTED_FORMATS
from utils.pdf_processor import compress_pdf, split_pdf, MAX_PDF_BYTES
from utils.validators import validate_magic_bytes

# Constants
WORKSPACE_TMP: Path = Path("workspace/tmp")
TEMPLATES_DIR: Path = Path("templates")
STATIC_DIR: Path = Path("static")
MAX_BATCH_FILES: int = int(os.environ.get("MAX_BATCH_FILES", "20"))
SITE_URL: str = os.environ.get("SITE_URL", "https://reshift.donnitriosa.my.id").rstrip("/")

# Rate Limiter setup
limiter = Limiter(key_func=get_remote_address)


def cleanup_tmp() -> None:
    """Wipes the temporary workspace directory on startup."""
    if WORKSPACE_TMP.exists():
        shutil.rmtree(WORKSPACE_TMP)
    WORKSPACE_TMP.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan context manager for startup and shutdown events."""
    cleanup_tmp()
    yield


def unique_name(name: str, used: set[str]) -> str:
    """Returns name, adding a -2, -3, ... suffix if already used. Records the result in used."""
    path = Path(name)
    candidate: str = name
    counter: int = 2
    while candidate in used:
        candidate = f"{path.stem}-{counter}{path.suffix}"
        counter += 1
    used.add(candidate)
    return candidate


def create_app() -> FastAPI:
    """Factory function to initialize and configure the FastAPI application."""
    app = FastAPI(
        title="Reshift",
        description="Utility Web App for Image/PDF processing",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Ensure directories exist before mounting to prevent startup errors
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

    @app.get("/", response_class=HTMLResponse)
    async def index(request: Request) -> HTMLResponse:
        """Renders the main frontend interface."""
        return templates.TemplateResponse(
            request=request, name="index.html", context={"site_url": SITE_URL}
        )

    @app.get("/health")
    async def health() -> dict[str, str]:
        """Liveness probe for Docker and Dokploy health checks."""
        return {"status": "ok"}

    @app.get("/robots.txt", include_in_schema=False)
    async def robots() -> Response:
        """Tells crawlers which paths to index and where the sitemap lives."""
        body: str = (
            "User-agent: *\n"
            "Allow: /\n"
            "Disallow: /process/\n"
            f"Sitemap: {SITE_URL}/sitemap.xml\n"
        )
        return Response(content=body, media_type="text/plain")

    @app.get("/sitemap.xml", include_in_schema=False)
    async def sitemap() -> Response:
        """Single-URL sitemap for the main page."""
        body: str = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"  <url><loc>{SITE_URL}/</loc></url>\n"
            "</urlset>\n"
        )
        return Response(content=body, media_type="application/xml")

    @app.post("/process/image")
    @limiter.limit("20/minute")
    async def process_image_endpoint(
        request: Request,
        file: UploadFile = File(...),
        width: int | None = Form(default=None),
        height: int | None = Form(default=None),
        output_format: str = Form(...),
        quality: int = Form(default=85, ge=1, le=100),
        smart_compress: bool = Form(default=False),
        crop_left: int | None = Form(default=None, ge=0),
        crop_top: int | None = Form(default=None, ge=0),
        crop_right: int | None = Form(default=None, ge=1),
        crop_bottom: int | None = Form(default=None, ge=1),
    ) -> StreamingResponse:
        """Endpoint to handle image resizing, conversion, and compression requests."""
        # 1. Validate File Size
        file_bytes: bytes = await file.read()
        if len(file_bytes) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds the limit of {MAX_FILE_BYTES // (1024 * 1024)} MB."
            )

        # 2. Magic Bytes Validation
        try:
            filename_ext = Path(file.filename or "").suffix.lstrip(".").upper()
            check_fmt = filename_ext if filename_ext in SUPPORTED_FORMATS else "PNG"
            validate_magic_bytes(file_bytes, check_fmt)
        except ValueError:
            valid = False
            for fmt in SUPPORTED_FORMATS:
                try:
                    validate_magic_bytes(file_bytes, fmt)
                    valid = True
                    break
                except ValueError:
                    continue
            if not valid:
                raise HTTPException(status_code=400, detail="Invalid image file header signature.")

        # 3. Process Image
        try:
            output_buffer, mime_type = process_image(
                file_bytes=file_bytes,
                output_format=output_format,
                width=width,
                height=height,
                quality=quality,
                smart_compress=smart_compress,
                crop_left=crop_left,
                crop_top=crop_top,
                crop_right=crop_right,
                crop_bottom=crop_bottom,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail="Internal image processing error.") from e

        # 4. Content disposition filename headers
        ext: str = output_format.lower()
        if ext == "jpeg":
            ext = "jpg"
        orig_stem: str = Path(file.filename or "image").stem
        filename: str = f"{orig_stem}-Reshift.{ext}"

        return StreamingResponse(
            output_buffer,
            media_type=mime_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    @app.post("/process/batch")
    @limiter.limit("10/minute")
    async def process_batch_endpoint(
        request: Request,
        files: list[UploadFile] = File(...),
        output_format: str = Form(...),
        quality: int = Form(default=85, ge=1, le=100),
        width: int | None = Form(default=None),
        height: int | None = Form(default=None),
        smart_compress: bool = Form(default=False),
        crop_left: int | None = Form(default=None, ge=0),
        crop_top: int | None = Form(default=None, ge=0),
        crop_right: int | None = Form(default=None, ge=1),
        crop_bottom: int | None = Form(default=None, ge=1),
    ) -> StreamingResponse:
        """Endpoint to handle batch image processing returning a ZIP archive."""
        if not files or len(files) == 0:
            raise HTTPException(status_code=400, detail="No files uploaded.")

        if len(files) > MAX_BATCH_FILES:
            raise HTTPException(
                status_code=400,
                detail=f"Batch size exceeds maximum limit of {MAX_BATCH_FILES} files."
            )

        zip_buffer = io.BytesIO()
        ext: str = output_format.lower()
        if ext == "jpeg":
            ext = "jpg"

        used_names: set[str] = set()
        with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for idx, file in enumerate(files):
                file_bytes: bytes = await file.read()
                if len(file_bytes) > MAX_FILE_BYTES:
                    continue

                valid = False
                for fmt in SUPPORTED_FORMATS:
                    try:
                        validate_magic_bytes(file_bytes, fmt)
                        valid = True
                        break
                    except ValueError:
                        continue
                if not valid:
                    continue

                try:
                    img_buffer, _ = process_image(
                        file_bytes=file_bytes,
                        output_format=output_format,
                        width=width,
                        height=height,
                        quality=quality,
                        smart_compress=smart_compress,
                        crop_left=crop_left,
                        crop_top=crop_top,
                        crop_right=crop_right,
                        crop_bottom=crop_bottom,
                    )
                    orig_stem = Path(file.filename or f"image_{idx + 1}").stem
                    out_filename = f"{orig_stem}-Reshift.{ext}"
                    zf.writestr(unique_name(out_filename, used_names), img_buffer.getvalue())
                except Exception:
                    continue

        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="Reshift-batch.zip"'}
        )

    @app.post("/process/pdf")
    @limiter.limit("10/minute")
    async def process_pdf_endpoint(
        request: Request,
        file: UploadFile = File(...),
    ) -> Response:
        """Endpoint to handle PDF compression requests."""
        # 1. Validate File Size
        file_bytes: bytes = await file.read()
        if len(file_bytes) > MAX_PDF_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF size exceeds limit of {MAX_PDF_BYTES // (1024 * 1024)} MB."
            )

        # 2. Magic Bytes Validation
        try:
            validate_magic_bytes(file_bytes, "PDF")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid PDF file header signature.")

        # 3. Compress PDF
        try:
            output_result, mode = compress_pdf(file_bytes, WORKSPACE_TMP)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail="Internal PDF processing error.") from e

        # 4. Return StreamingResponse (in-memory) or FileResponse (disk staging)
        orig_stem: str = Path(file.filename or "document").stem
        filename: str = f"{orig_stem}-Reshift.pdf"
        headers: dict[str, str] = {"Content-Disposition": f'attachment; filename="{filename}"'}

        if mode == "file" and isinstance(output_result, Path):
            cleanup_task = BackgroundTask(lambda: output_result.unlink(missing_ok=True))
            return FileResponse(
                path=output_result,
                media_type="application/pdf",
                headers=headers,
                background=cleanup_task,
            )

        return StreamingResponse(
            output_result,
            media_type="application/pdf",
            headers=headers,
        )

    @app.post("/process/pdf/split")
    @limiter.limit("10/minute")
    async def split_pdf_endpoint(
        request: Request,
        file: UploadFile = File(...),
    ) -> StreamingResponse:
        """Endpoint to split PDF into per-page PDF files inside a ZIP archive."""
        file_bytes: bytes = await file.read()
        if len(file_bytes) > MAX_PDF_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF size exceeds limit of {MAX_PDF_BYTES // (1024 * 1024)} MB."
            )

        try:
            validate_magic_bytes(file_bytes, "PDF")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid PDF file header signature.")

        orig_stem: str = Path(file.filename or "document").stem

        try:
            zip_buffer = split_pdf(file_bytes, orig_stem=orig_stem)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail="Internal PDF splitting error.") from e

        filename: str = f"{orig_stem}-Reshift-pages.zip"
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    return app


app: FastAPI = create_app()
