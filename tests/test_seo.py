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
    assert f"<loc>{SITE_URL}/privacy</loc>" in response.text
    assert f"<loc>{SITE_URL}/terms</loc>" in response.text


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
    assert "Free Online Image &amp; PDF Compressor, Resizer, and Converter" in html
    assert 'property="og:site_name" content="Reshift"' in html
    assert 'property="og:image:alt"' in html
    assert 'name="twitter:title"' in html
    assert 'name="twitter:description"' in html
    assert 'name="twitter:image"' in html
    assert '"featureList"' in html
    assert "https://donnitriosa.my.id" in html
    assert "Why Use Reshift for Image" in html
    assert 'href="/privacy"' in html
    assert 'href="/terms"' in html
    assert 'id="error-banner"' in html


def test_head_requests_allowed() -> None:
    for path in ("/", "/privacy", "/terms", "/health", "/robots.txt", "/sitemap.xml"):
        response = client.head(path)
        assert response.status_code == 200, f"HEAD {path} returned {response.status_code}"


def test_legal_pages_render_and_respect_noindex(monkeypatch: pytest.MonkeyPatch) -> None:
    for path, title in (("/privacy", "Privacy Policy"), ("/terms", "Terms &amp; Conditions")):
        response = client.get(path)
        assert response.status_code == 200
        assert f'<link rel="canonical" href="{SITE_URL}{path}">' in response.text
        assert title in response.text

    monkeypatch.setattr(main, "NOINDEX", True)
    for path in ("/privacy", "/terms"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["x-robots-tag"] == "noindex, nofollow"
        assert 'name="robots" content="noindex, nofollow"' in response.text


def test_custom_404_page() -> None:
    response = client.get("/nonexistent-route")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/html")
    assert "404" in response.text
    assert "Frame Out of Bounds" in response.text
    assert 'name="robots" content="noindex, nofollow"' in response.text
    assert 'href="/"' in response.text

    head_response = client.head("/nonexistent-route")
    assert head_response.status_code == 404
