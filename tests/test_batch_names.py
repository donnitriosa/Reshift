from __future__ import annotations

import io
import zipfile

from fastapi.testclient import TestClient
from PIL import Image

from main import app, unique_name

client = TestClient(app)


def test_unique_name_adds_suffix_on_collision() -> None:
    used: set[str] = set()
    assert unique_name("a-Reshift.png", used) == "a-Reshift.png"
    assert unique_name("a-Reshift.png", used) == "a-Reshift-2.png"
    assert unique_name("a-Reshift.png", used) == "a-Reshift-3.png"


def test_batch_same_stem_files_get_unique_entries() -> None:
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), (0, 0, 255)).save(buf, format="PNG")
    png_bytes = buf.getvalue()
    response = client.post(
        "/process/batch",
        files=[
            ("files", ("sample.png", png_bytes, "image/png")),
            ("files", ("sample.png", png_bytes, "image/png")),
        ],
        data={"output_format": "WEBP"},
    )
    assert response.status_code == 200
    names = zipfile.ZipFile(io.BytesIO(response.content)).namelist()
    assert names == ["sample-Reshift.webp", "sample-Reshift-2.webp"]
