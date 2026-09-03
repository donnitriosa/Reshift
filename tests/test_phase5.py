from __future__ import annotations

import io
from PIL import Image
from fastapi.testclient import TestClient

from main import app
from utils.image_processor import process_image, crop_image, smart_compress_image

client = TestClient(app)


def create_dummy_image(format_name: str = "PNG", size: tuple[int, int] = (200, 200), color: tuple[int, int, int] = (255, 0, 0)) -> bytes:
    """Helper to generate dummy image bytes in memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format_name)
    return buf.getvalue()


def test_crop_image_unit():
    """Unit test for crop_image helper."""
    img = Image.new("RGB", (200, 200), color=(0, 255, 0))
    cropped = crop_image(img, left=10, top=20, right=100, bottom=120)
    assert cropped.size == (90, 100)


def test_crop_image_invalid_bounds():
    """Unit test verifying crop_image raises ValueError on invalid bounds."""
    img = Image.new("RGB", (100, 100))
    try:
        crop_image(img, left=50, top=0, right=20, bottom=50)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "must be less than right" in str(e)


def test_smart_compress_unit():
    """Unit test verifying smart compression returns valid bytes."""
    raw_bytes = create_dummy_image("JPEG", size=(500, 500))
    img = Image.open(io.BytesIO(raw_bytes))
    result = smart_compress_image(img, "JPEG", len(raw_bytes))
    # Returns buffer if compressed <= input size, or None if fallback triggered
    if result is not None:
        assert len(result.getvalue()) <= len(raw_bytes)


def test_process_image_endpoint_crop():
    """Integration test for POST /process/image endpoint with crop parameters."""
    dummy_bytes = create_dummy_image("PNG", size=(300, 300))
    response = client.post(
        "/process/image",
        files={"file": ("test.png", dummy_bytes, "image/png")},
        data={
            "output_format": "PNG",
            "crop_left": 10,
            "crop_top": 10,
            "crop_right": 110,
            "crop_bottom": 110,
        },
    )
    assert response.status_code == 200
    res_img = Image.open(io.BytesIO(response.content))
    assert res_img.size == (100, 100)


def test_process_image_endpoint_smart_compress():
    """Integration test for POST /process/image endpoint with smart_compress=true."""
    dummy_bytes = create_dummy_image("JPEG", size=(400, 400))
    response = client.post(
        "/process/image",
        files={"file": ("test.jpg", dummy_bytes, "image/jpeg")},
        data={
            "output_format": "JPEG",
            "smart_compress": "true",
        },
    )
    assert response.status_code == 200
    assert len(response.content) > 0


def test_process_batch_endpoint_crop():
    """Integration test for POST /process/batch endpoint with crop parameters."""
    dummy_1 = create_dummy_image("PNG", size=(200, 200))
    dummy_2 = create_dummy_image("PNG", size=(300, 300))

    response = client.post(
        "/process/batch",
        files=[
            ("files", ("img1.png", dummy_1, "image/png")),
            ("files", ("img2.png", dummy_2, "image/png")),
        ],
        data={
            "output_format": "PNG",
            "crop_left": 0,
            "crop_top": 0,
            "crop_right": 100,
            "crop_bottom": 100,
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
