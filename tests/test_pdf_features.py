from __future__ import annotations

import io
import zipfile

import fitz
from fastapi.testclient import TestClient
from PIL import Image

from main import app
from utils.pdf_processor import split_pdf

client = TestClient(app)


def create_dummy_pdf(num_pages: int = 3, prefix: str = "Page") -> bytes:
    """Helper to generate a valid multi-page PDF in memory."""
    buf = io.BytesIO()
    with fitz.open() as doc:
        for i in range(1, num_pages + 1):
            page = doc.new_page()
            page.insert_text((72, 72), f"{prefix} {i}")
        doc.save(buf)
    return buf.getvalue()


def test_split_pdf_custom_page_range() -> None:
    """split_pdf with page_range='1, 3' extracts only pages 1 and 3."""
    pdf_bytes = create_dummy_pdf(num_pages=4)
    zip_buf = split_pdf(pdf_bytes, orig_stem="doc", page_range="1, 3")
    with zipfile.ZipFile(zip_buf, "r") as zf:
        names = zf.namelist()
        assert names == ["doc-Reshift-page_1.pdf", "doc-Reshift-page_3.pdf"]


def test_split_pdf_invalid_page_range_returns_400() -> None:
    """POST /process/pdf/split rejects out-of-bounds page ranges with HTTP 400."""
    pdf_bytes = create_dummy_pdf(num_pages=2)
    response = client.post(
        "/process/pdf/split",
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
        data={"page_range": "99"},
    )
    assert response.status_code == 400
    assert "out of bounds" in response.json()["detail"].lower()


def test_merge_pdfs_endpoint() -> None:
    """POST /process/pdf/merge combines multiple PDFs preserving total page count."""
    pdf1 = create_dummy_pdf(num_pages=2, prefix="DocA")
    pdf2 = create_dummy_pdf(num_pages=3, prefix="DocB")

    response = client.post(
        "/process/pdf/merge",
        files=[
            ("files", ("a.pdf", pdf1, "application/pdf")),
            ("files", ("b.pdf", pdf2, "application/pdf")),
        ],
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    with fitz.open(stream=response.content, filetype="pdf") as merged:
        assert len(merged) == 5


def test_pdf_to_images_endpoint() -> None:
    """POST /process/pdf/to-images renders selected pages into valid PNG images in a ZIP."""
    pdf_bytes = create_dummy_pdf(num_pages=3)
    response = client.post(
        "/process/pdf/to-images",
        files={"file": ("slides.pdf", pdf_bytes, "application/pdf")},
        data={"output_format": "PNG", "page_range": "1-2"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(response.content), "r") as zf:
        names = zf.namelist()
        assert names == ["slides-Reshift-page_1.png", "slides-Reshift-page_2.png"]
        for name in names:
            with Image.open(io.BytesIO(zf.read(name))) as img:
                assert img.format == "PNG"
                assert img.width > 0
