# Reshift

<p align="center">
  <img src="static/image/logo.png" alt="Reshift Logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Fast, In-Memory Image & PDF Processing Utility Web Application</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-endpoints">API Endpoints</a> •
  <a href="#security">Security</a> •
  <a href="#directory-structure">Structure</a>
</p>

---

## Overview

**Reshift** is a lightweight, high-performance web utility for image and PDF manipulation built with FastAPI and Jinja2. Designed with an **in-memory-first** architecture, all processing occurs directly in RAM (`io.BytesIO`) to minimize disk I/O, ensure speed, and protect user data privacy.

---

## Features

### Image Processing
- **Format Conversion:** Convert images between **PNG**, **JPEG**, and **WEBP**.
- **Resize & Aspect Ratio:** Custom target width/height with smart aspect ratio preservation.
- **Quality Control:** Adjustable compression quality slider (1–100%) for JPEG and WEBP outputs.
- **Batch Processing:** Process up to 20 images simultaneously and download as a single `Reshift-batch.zip` archive.
- **Live Preview:** Instant image preview with pixel dimensions and size metadata.

### PDF Processing
- **PDF Compression:** Compress internal image streams, strip unused metadata, and optimize PDF structure.
- **Page Splitting:** Split multi-page PDFs into individual single-page PDF files bundled inside a ZIP archive.
- **Smart Staging:** Small PDFs process entirely in-memory; large PDFs (> 10 MB) utilize temporary staging with automatic cleanup.

### Security & UX
- **Magic Bytes Validation:** Binary header validation (`\x89PNG`, `\xff\xd8\xff`, `RIFF...WEBP`, `%PDF-`) preventing MIME-spoofing attacks.
- **Rate Limiting:** Per-IP request limits powered by `slowapi` to prevent abuse.
- **Modern Responsive UI:** Clean interface with Light/Dark mode toggle and Drag-and-Drop upload support.
- **Standardized Downloads:** All output files automatically preserve the original filename stem with a `-Reshift` suffix (e.g., `photo-Reshift.png`, `doc-Reshift-pages.zip`).

---

## Tech Stack

| Category | Technology |
| --- | --- |
| **Backend** | Python 3.10+, FastAPI, Uvicorn |
| **Frontend** | Jinja2 Templates, Vanilla JavaScript, Custom CSS |
| **Image Processing** | Pillow (PIL) |
| **PDF Processing** | PyMuPDF (fitz) |
| **Security & Rate Limiting** | slowapi |
| **Packaging** | Standard library `zipfile` & `io.BytesIO` |

---

## Quick Start

### Prerequisites
- Python 3.10 or higher

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/user/Reshift.git
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

4. **Run the application:**
   ```bash
   uvicorn main:app --reload
   ```

5. **Open in browser:**
   Navigate to `http://127.0.0.1:8000`

---

## API Endpoints

| Method | Endpoint | Description | Rate Limit |
| --- | --- | --- | --- |
| `GET` | `/` | Main web UI dashboard | — |
| `POST` | `/process/image` | Process single image (resize, convert, compress) | 20 / min |
| `POST` | `/process/batch` | Batch process multiple images → returns ZIP archive | 10 / min |
| `POST` | `/process/pdf` | Compress PDF file & strip metadata | 10 / min |
| `POST` | `/process/pdf/split` | Split PDF into individual single-page PDFs → returns ZIP | 10 / min |

---

## Technical Limits

| Resource | Limit |
| --- | --- |
| Max Image File Size | **20 MB** per image |
| Max PDF File Size | **50 MB** per document |
| Max Batch Files | **20 files** per request |
| PDF Disk Staging Threshold | **10 MB** (files below this stay in-memory) |

---

## Security

Reshift implements defense-in-depth measures to handle untrusted file uploads safely:

1. **Binary Signature Verification (Magic Bytes):**
   Validation is performed on raw byte headers before handing data to Pillow or PyMuPDF, rejecting disguised malicious payloads.

   | Format | Magic Bytes Signature |
   | --- | --- |
   | **PNG** | `\x89PNG\r\n\x1a\n` |
   | **JPEG** | `\xff\xd8\xff` |
   | **WEBP** | `RIFF....WEBP` |
   | **PDF** | `%PDF-` |

2. **Per-IP Rate Limiting:** Rate limits enforced at router level return HTTP 429 when threshold is exceeded.
3. **Automatic Workspace Cleanup:** Temporary staging files in `workspace/tmp/` are automatically wiped on application startup via FastAPI lifespan hooks and cleaned up immediately post-response using `BackgroundTask`.

---

## Directory Structure

```text
Reshift/
├── main.py              # Application entry point & FastAPI routes
├── requirements.txt     # Python dependencies
├── TASKS.md             # Project roadmap & progress tracker
├── README.md            # Project documentation
├── docs/                # Architecture & workflow documentation
│   ├── ARCHITECTURE.md
│   └── WORKFLOWS.md
├── utils/               # Core processing engines
│   ├── image_processor.py   # Pillow image manipulation
│   ├── pdf_processor.py     # PyMuPDF compression & splitting
│   └── validators.py        # Magic bytes validation logic
├── static/              # Static frontend assets
│   ├── css/
│   │   └── style.css        # Responsive styling (Light/Dark mode)
│   ├── image/               # App logo & favicons
│   │   ├── logo.png
│   │   └── favicon.ico
│   └── js/
│       └── main.js          # Drag-and-drop & Fetch API integration
├── templates/           # HTML templates
│   └── index.html       # Single Page Interface
└── workspace/
    └── tmp/             # Temporary staging for large PDFs (auto-cleared)
```

---

## License

Distributed under the MIT License. See `LICENSE` for details.
