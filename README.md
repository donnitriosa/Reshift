# Reshift

<p align="center">
  <img src="static/image/logo.png" alt="Reshift Logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Fast, In-Memory Image &amp; PDF Processing Utility Web Application</strong><br />
  Live at <a href="https://reshift.donnitriosa.my.id/">reshift.donnitriosa.my.id</a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#docker-deployment">Docker Deployment</a> •
  <a href="#api-endpoints">API Endpoints</a> •
  <a href="#environment-variables">Environment</a> •
  <a href="#security">Security</a> •
  <a href="#directory-structure">Structure</a>
</p>

---

## Overview

**Reshift** is a lightweight, privacy-first monolith web utility for image and PDF manipulation built with **FastAPI**, **Jinja2**, **Pillow**, and **PyMuPDF**. Designed with an **in-memory-first** architecture, image processing runs strictly in RAM (`io.BytesIO`), while large PDFs (> 10 MB) use temporary isolated staging in `workspace/tmp/` with immediate post-response cleanup.

---

## Features

### Image Mode (`PNG`, `JPEG`, `WEBP`)

- **All-in-One Pipeline:** Combine crop, resize, format conversion, and quality control in a single request (`All-in-One | Compress | Resize | Convert | Crop`).
- **Smart Compress:** Format-optimal compression without manual quality tuning:
  - **JPEG:** `optimize=True, quality=95` (visually lossless).
  - **WEBP:** `lossless=True, method=6` (maximum lossless compression).
  - **PNG:** `optimize=True, compress_level=9` (maximum zlib compression).
  - **Original-Bytes Size Guard:** Automatically returns the original bytes when smart compression does not shrink an unedited same-format image.
- **Resize & EXIF Orientation Fix:** LANCZOS resampling with aspect-ratio lock (`width`/`height`) plus automatic `ImageOps.exif_transpose()` so portrait smartphone photos never rotate sideways.
- **Interactive Visual Crop:** Pixel-accurate bounding-box crop (`crop_left`, `crop_top`, `crop_right`, `crop_bottom`) with a rule-of-thirds overlay, 8 resize handles, and Pointer Events support for desktop mouse and mobile touch.
- **Batch Processing:** Process up to 20 images simultaneously into `Reshift-batch.zip` with collision-safe filenames and an empty-batch `HTTP 400` guard.

### PDF Mode (Up to 50 MB)

- **PDF Compression:** Strips unused metadata and compresses streams, images, and fonts (`garbage=4, deflate=True`).
- **Split & Custom Page Range:** Extract all pages or a custom range (e.g. `1-3, 5`) into individual single-page PDFs bundled inside `{stem}-Reshift-pages.zip`.
- **PDF to Images:** Render all or selected PDF pages at 150 DPI into **PNG** or **JPEG** images inside `{stem}-Reshift-images.zip`.
- **Merge PDFs:** Combine multiple PDFs (2–20 files) into `Reshift-merged.pdf` with cumulative one-by-one/multi-file upload and an interactive sortable queue (`↑` / `↓` / remove).

### UX, SEO, Legal & Error Handling

- **Before/After Size Savings:** Displays `input → output (-X% saved)` for compressed images and PDFs, plus ZIP output sizes.
- **Inline Error Banner & Light/Dark Theme:** Non-blocking dismissible error banner and `localStorage`-persisted light/dark mode matching `donnitriosa.my.id`.
- **SEO & Crawling:** `GET`/`HEAD` support on public routes, `/robots.txt`, `/sitemap.xml`, Open Graph / Twitter Card (`1200×630` `og-image.png`), JSON-LD `WebApplication` metadata, and `NOINDEX` staging toggle.
- **Legal & Custom 404:** Dedicated `/privacy` and `/terms` pages linked in the footer, plus a Reshift-themed Canvas & Memory Inspector `404` page (`templates/404.html`).

---

## Tech Stack

| Category | Technology |
| --- | --- |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **Frontend** | Jinja2 Templates, Vanilla JavaScript (Fetch API), Custom CSS |
| **Image Processing** | Pillow (PIL) |
| **PDF Processing** | PyMuPDF (`pymupdf` / `fitz`) |
| **Security & Rate Limiting** | Magic Bytes validation, `slowapi`, 50 MP pixel limit |
| **Deployment** | Docker (`python:3.11-slim`, non-root `reshift`), Docker Compose, Dokploy + Traefik |

---

## Quick Start

### Prerequisites

- Python 3.11+ (`.venv` recommended)

### Local Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/donnitriosa/Reshift.git
   cd Reshift
   ```

2. **Create and activate a virtual environment:**

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure optional environment overrides:**

   ```bash
   cp .env.example .env
   ```

5. **Run the application:**

   ```bash
   uvicorn main:app --reload
   ```

6. **Run tests:**

   ```bash
   .venv/bin/python -m pytest -q
   ```

---

## Docker Deployment

Reshift ships as a single non-root container (`Dockerfile` + `docker-compose.yml`) routed behind Dokploy/Traefik with a `1g` memory limit and `/health` probe. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full deployment guide.

```bash
docker build -t reshift:local .
docker run --rm -p 8000:8000 reshift:local
```

---

## API Endpoints

| Method | Endpoint | Description | Rate Limit |
| --- | --- | --- | --- |
| `GET`, `HEAD` | `/` | Main web UI | — |
| `GET`, `HEAD` | `/privacy` | Privacy Policy page | — |
| `GET`, `HEAD` | `/terms` | Terms &amp; Conditions page | — |
| `GET`, `HEAD` | `/health` | Container healthcheck (`{"status": "ok"}`) | — |
| `GET`, `HEAD` | `/robots.txt` | Crawler directives (`NOINDEX`-aware) | — |
| `GET`, `HEAD` | `/sitemap.xml` | Canonical sitemap (`/`, `/privacy`, `/terms`) | — |
| `POST` | `/process/image` | Crop, resize, convert, smart/quality compress single image | 20 / min |
| `POST` | `/process/batch` | Batch process up to `MAX_BATCH_FILES` images → ZIP | 10 / min |
| `POST` | `/process/pdf` | Compress PDF &amp; strip metadata | 10 / min |
| `POST` | `/process/pdf/split` | Split PDF (all or `page_range`) → ZIP of single-page PDFs | 10 / min |
| `POST` | `/process/pdf/merge` | Merge 2+ PDFs into `Reshift-merged.pdf` | 10 / min |
| `POST` | `/process/pdf/to-images` | Render PDF pages (`PNG`/`JPEG`, optional `page_range`) → ZIP | 10 / min |

---

## Environment Variables

All variables are optional and read from `.env` (or container environment) with defaults in [`.env.example`](.env.example):

| Variable | Default | Description |
| --- | --- | --- |
| `MAX_FILE_MB` | `20` | Maximum image upload size in MB |
| `MAX_PDF_MB` | `50` | Maximum PDF upload size (and merge total size) in MB |
| `MAX_BATCH_FILES` | `20` | Maximum files per batch image or PDF merge request |
| `SITE_URL` | `https://reshift.donnitriosa.my.id` | Canonical URL for meta tags, `sitemap.xml`, and `robots.txt` |
| `NOINDEX` | `false` | Set `true` on staging to emit `X-Robots-Tag: noindex, nofollow` and hide sitemap |

---

## Security

1. **Magic Bytes Signature Validation (`utils/validators.py`):** Verifies raw binary headers (`\x89PNG\r\n\x1a\n`, `\xff\xd8\xff`, `RIFF....WEBP`, `%PDF-`) before handing payloads to Pillow or PyMuPDF.
2. **Decompression Bomb Protection:** Caps `Image.MAX_IMAGE_PIXELS` at `50_000_000` (50 MP) in `utils/image_processor.py`, returning `HTTP 400` on oversized payloads.
3. **Per-IP Rate Limiting:** Enforced via `slowapi` (`20/minute` image, `10/minute` batch/PDF) with proxy IP forwarding (`--proxy-headers --forwarded-allow-ips "*"`).
4. **Automatic Staging Purge:** `workspace/tmp/` is wiped on startup (`cleanup_tmp()`) and staged PDFs (> 10 MB) are deleted immediately after delivery via `BackgroundTask`.

---

## Directory Structure

```text
Reshift/
├── main.py                  # FastAPI entry point, routes, SEO & custom 404 handler
├── requirements.txt         # Python dependencies
├── Dockerfile               # python:3.11-slim container (non-root user reshift)
├── docker-compose.yml       # Production compose service with dokploy-network
├── .env.example             # Documented runtime configuration defaults
├── TASKS.md                 # Project roadmap & completion tracker
├── docs/
│   ├── ARCHITECTURE.md      # Module map, data flow & security overview
│   ├── WORKFLOWS.md         # Image & PDF processing pipelines
│   └── DEPLOYMENT.md        # Local Docker & Dokploy setup guide
├── utils/
│   ├── image_processor.py   # Pillow crop, resize, EXIF fix, smart compress & 50 MP cap
│   ├── pdf_processor.py     # PyMuPDF compress, page-range split, merge & render to images
│   └── validators.py        # Binary magic-bytes signature validation
├── static/
│   ├── css/style.css        # Responsive light/dark theme styling
│   ├── image/               # Redesigned vector logo.svg, logo.png, favicon.ico, og-image.png
│   └── js/main.js           # Drag-and-drop, interactive Pointer crop, Fetch API & queue UI
├── templates/
│   ├── index.html           # Main utility UI + SEO metadata
│   ├── privacy.html         # Privacy Policy page (/privacy)
│   ├── terms.html           # Terms & Conditions page (/terms)
│   └── 404.html             # Canvas & Memory Inspector 404 page
├── tests/                   # Pytest unit & integration suite
└── workspace/tmp/           # Temporary staging for PDFs > 10 MB (auto-purged)
```

---

## License

Distributed under the MIT License. See `LICENSE` for details.
