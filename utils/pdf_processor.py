from __future__ import annotations

import io
import os
import uuid
import zipfile
from pathlib import Path
import fitz  # PyMuPDF

MAX_PDF_BYTES: int = int(os.environ.get("MAX_PDF_MB", "50")) * 1024 * 1024
LARGE_PDF_THRESHOLD: int = 10 * 1024 * 1024  # 10 MB threshold for disk staging


def parse_page_range(page_range: str | None, total_pages: int) -> list[int]:
    """
    Parses a 1-based page range string (e.g. '1-3, 5') into deduplicated 0-based page indices.
    Returns all page indices when page_range is None or blank.
    """
    if page_range is None or not page_range.strip():
        return list(range(total_pages))

    selected: list[int] = []
    seen: set[int] = set()

    for raw_token in page_range.split(","):
        token = raw_token.strip()
        if not token:
            raise ValueError("Invalid empty page number in range.")

        if "-" in token:
            parts = token.split("-")
            if len(parts) != 2:
                raise ValueError(f"Invalid page range: '{token}'.")
            try:
                start = int(parts[0].strip())
                end = int(parts[1].strip())
            except ValueError as e:
                raise ValueError(f"Invalid page numbers in range: '{token}'.") from e
            if start < 1 or end > total_pages or start > end:
                raise ValueError(f"Page range '{token}' is out of bounds (1-{total_pages}).")
            for p in range(start, end + 1):
                if p - 1 not in seen:
                    seen.add(p - 1)
                    selected.append(p - 1)
        else:
            try:
                page_num = int(token)
            except ValueError as e:
                raise ValueError(f"Invalid page number: '{token}'.") from e
            if page_num < 1 or page_num > total_pages:
                raise ValueError(f"Page {page_num} is out of bounds (1-{total_pages}).")
            if page_num - 1 not in seen:
                seen.add(page_num - 1)
                selected.append(page_num - 1)

    if not selected:
        raise ValueError("No valid pages selected.")
    return selected


def compress_pdf(
    file_bytes: bytes,
    workspace_tmp: Path,
) -> tuple[io.BytesIO | Path, str]:
    """
    Compresses PDF internal streams, garbage-collects unused objects, and strips metadata.
    Returns a tuple of (output_source, storage_mode) where storage_mode is 'memory' or 'file'.
    """
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            doc.set_metadata({})

            output_buffer = io.BytesIO()
            doc.save(
                output_buffer,
                garbage=4,
                deflate=True,
                deflate_images=True,
                deflate_fonts=True,
            )
            output_bytes_size: int = output_buffer.tell()
            output_buffer.seek(0)

            if output_bytes_size > LARGE_PDF_THRESHOLD:
                workspace_tmp.mkdir(parents=True, exist_ok=True)
                file_path: Path = workspace_tmp / f"{uuid.uuid4()}.pdf"
                file_path.write_bytes(output_buffer.getvalue())
                return file_path, "file"

            return output_buffer, "memory"

    except Exception as e:
        if "FileDataError" in type(e).__name__ or "cannot open" in str(e).lower():
            raise ValueError("Invalid or corrupted PDF file.") from e
        raise e


def split_pdf(
    file_bytes: bytes,
    orig_stem: str = "document",
    page_range: str | None = None,
) -> io.BytesIO:
    """
    Splits selected pages of the input PDF into individual single-page PDF files,
    compiles them into a single ZIP archive, and returns the in-memory buffer.
    Files inside ZIP follow naming convention: {orig_stem}-Reshift-page_{n}.pdf
    """
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as src_doc:
            total_pages: int = len(src_doc)
            if total_pages == 0:
                raise ValueError("PDF file contains no pages.")

            selected_indices = parse_page_range(page_range, total_pages)
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
                for page_index in selected_indices:
                    with fitz.open() as page_doc:
                        page_doc.insert_pdf(src_doc, from_page=page_index, to_page=page_index)
                        page_bytes = page_doc.write()

                    page_filename = f"{orig_stem}-Reshift-page_{page_index + 1}.pdf"
                    zf.writestr(page_filename, page_bytes)

            zip_buffer.seek(0)
            return zip_buffer

    except ValueError:
        raise
    except Exception as e:
        if "FileDataError" in type(e).__name__ or "cannot open" in str(e).lower():
            raise ValueError("Invalid or corrupted PDF file.") from e
        raise e


def merge_pdfs(
    files_bytes: list[bytes],
    workspace_tmp: Path,
) -> tuple[io.BytesIO | Path, str]:
    """
    Merges multiple PDF files in order into a single PDF.
    Returns (output_source, storage_mode) where storage_mode is 'memory' or 'file'.
    """
    if len(files_bytes) < 2:
        raise ValueError("At least 2 PDF files are required for merging.")

    try:
        with fitz.open() as merged_doc:
            for pdf_bytes in files_bytes:
                with fitz.open(stream=pdf_bytes, filetype="pdf") as src_doc:
                    if len(src_doc) == 0:
                        raise ValueError("One of the PDF files contains no pages.")
                    merged_doc.insert_pdf(src_doc)

            output_buffer = io.BytesIO()
            merged_doc.save(output_buffer, garbage=3, deflate=True)
            output_bytes_size: int = output_buffer.tell()
            output_buffer.seek(0)

            if output_bytes_size > LARGE_PDF_THRESHOLD:
                workspace_tmp.mkdir(parents=True, exist_ok=True)
                file_path: Path = workspace_tmp / f"{uuid.uuid4()}.pdf"
                file_path.write_bytes(output_buffer.getvalue())
                return file_path, "file"

            return output_buffer, "memory"

    except ValueError:
        raise
    except Exception as e:
        if "FileDataError" in type(e).__name__ or "cannot open" in str(e).lower():
            raise ValueError("Invalid or corrupted PDF file.") from e
        raise e


def pdf_to_images(
    file_bytes: bytes,
    orig_stem: str = "document",
    image_format: str = "PNG",
    page_range: str | None = None,
    dpi: int = 150,
) -> io.BytesIO:
    """
    Renders selected PDF pages as PNG or JPEG images packaged into a ZIP archive.
    """
    fmt = image_format.upper()
    if fmt == "JPG":
        fmt = "JPEG"
    if fmt not in ("PNG", "JPEG"):
        raise ValueError(f"Unsupported PDF image output format: {image_format}")

    ext = "jpg" if fmt == "JPEG" else "png"

    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as src_doc:
            total_pages: int = len(src_doc)
            if total_pages == 0:
                raise ValueError("PDF file contains no pages.")

            selected_indices = parse_page_range(page_range, total_pages)
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
                for page_index in selected_indices:
                    pix = src_doc[page_index].get_pixmap(dpi=dpi, alpha=(fmt == "PNG"))
                    img_bytes = pix.tobytes(fmt.lower())
                    img_filename = f"{orig_stem}-Reshift-page_{page_index + 1}.{ext}"
                    zf.writestr(img_filename, img_bytes)

            zip_buffer.seek(0)
            return zip_buffer

    except ValueError:
        raise
    except Exception as e:
        if "FileDataError" in type(e).__name__ or "cannot open" in str(e).lower():
            raise ValueError("Invalid or corrupted PDF file.") from e
        raise e
