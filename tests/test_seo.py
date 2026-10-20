from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import main
from main import SITE_URL, app

client = TestClient(app)


def test_robots_txt_points_to_sitemap() -> None:
    response = client.get("/robots.txt")
    assert response.status_code == 200
    assert "Disallow: /process/" in response.text
    assert f"Sitemap: {SITE_URL}/sitemap.xml" in response.text


def test_sitemap_lists_canonical_url() -> None:
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert f"<loc>{SITE_URL}/</loc>" in response.text


def test_noindex_mode_blocks_indexing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "NOINDEX", True)
    response = client.get("/")
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert 'name="robots" content="noindex, nofollow"' in response.text
    assert "Sitemap:" not in client.get("/robots.txt").text

def test_index_has_seo_tags() -> None:
    html = client.get("/").text
    assert f'<link rel="canonical" href="{SITE_URL}/">' in html
    assert 'name="description"' in html
    assert "application/ld+json" in html
