from __future__ import annotations

import io
import os
import uuid
import zipfile
from pathlib import Path
import fitz  # PyMuPDF

MAX_PDF_BYTES: int = int(os.environ.get("MAX_PDF_MB", "50")) * 1024 * 1024
LARGE_PDF_THRESHOLD: int = 10 * 1024 * 1024  # 10 MB threshold for disk staging


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
            # Strip unused metadata for privacy and size reduction
            doc.set_metadata({})

            # In-memory buffer test
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

            # Staging decision based on output size
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


def split_pdf(file_bytes: bytes, orig_stem: str = "document") -> io.BytesIO:
    """
    Splits each page of the input PDF into individual single-page PDF files,
    compiles them into a single ZIP archive, and returns the in-memory buffer.
    Files inside ZIP follow naming convention: {orig_stem}-Reshift-page_{n}.pdf
    """
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as src_doc:
            total_pages: int = len(src_doc)
            if total_pages == 0:
                raise ValueError("PDF file contains no pages.")

            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
                for page_index in range(total_pages):
                    page_doc = fitz.open()  # empty single-page doc
                    page_doc.insert_pdf(src_doc, from_page=page_index, to_page=page_index)

                    page_bytes = page_doc.write()
                    page_doc.close()

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
