from __future__ import annotations

from fastapi.testclient import TestClient

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


def test_index_has_seo_tags() -> None:
    html = client.get("/").text
    assert f'<link rel="canonical" href="{SITE_URL}/">' in html
    assert 'name="description"' in html
    assert "application/ld+json" in html
