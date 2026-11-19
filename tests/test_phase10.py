from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from main import app
from utils.image_processor import process_image

client = TestClient(app)


def test_exif_orientation_auto_transpose() -> None:
    """EXIF orientation tag 6 (90° CW) is automatically transposed into upright dimensions."""
    buf = io.BytesIO()
    img = Image.new("RGB", (120, 60), color=(255, 128, 0))
    exif = img.getexif()
    exif[0x0112] = 6
    img.save(buf, format="JPEG", exif=exif)

    out_buf, mime_type = process_image(
        file_bytes=buf.getvalue(),
        output_format="JPEG",
        width=None,
        height=None,
    )
    assert mime_type == "image/jpeg"
    with Image.open(out_buf) as result_img:
        assert result_img.size == (60, 120)


def test_smart_compress_returns_original_bytes_when_larger() -> None:
    """When smart_compress produces >= input bytes without crop/resize, return original bytes."""
    buf = io.BytesIO()
    img = Image.new("RGB", (1, 1), color=(10, 20, 30))
    img.save(buf, format="PNG", optimize=True, compress_level=9)
    raw_bytes = buf.getvalue()

    out_buf, mime_type = process_image(
        file_bytes=raw_bytes,
        output_format="PNG",
        width=None,
        height=None,
        smart_compress=True,
    )
    assert mime_type == "image/png"
    assert out_buf.getvalue() == raw_bytes


def test_decompression_bomb_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """Oversized pixel dimensions triggering DecompressionBombError return HTTP 400."""
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1000)
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), color=(0, 0, 255)).save(buf, format="PNG")

    response = client.post(
        "/process/image",
        files={"file": ("huge.png", buf.getvalue(), "image/png")},
        data={"output_format": "PNG"},
    )
    assert response.status_code == 400
    assert "maximum safe pixel limit" in response.json()["detail"]


def test_batch_empty_zip_guard_returns_400() -> None:
    """If all images in a batch fail processing (e.g., crop box too large), return HTTP 400."""
    buf1 = io.BytesIO()
    buf2 = io.BytesIO()
    Image.new("RGB", (100, 100), color=(255, 0, 0)).save(buf1, format="PNG")
    Image.new("RGB", (100, 100), color=(0, 255, 0)).save(buf2, format="PNG")

    response = client.post(
        "/process/batch",
        files=[
            ("files", ("a.png", buf1.getvalue(), "image/png")),
            ("files", ("b.png", buf2.getvalue(), "image/png")),
        ],
        data={
            "output_format": "PNG",
            "crop_left": 0,
            "crop_top": 0,
            "crop_right": 500,
            "crop_bottom": 500,
        },
    )
    assert response.status_code == 400
    assert "No valid images could be processed" in response.json()["detail"]
