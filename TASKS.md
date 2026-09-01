# Reshift — Project Roadmap

## Phase 1: Image Mode
- [x] Initialize project (TASKS.md, ARCHITECTURE.md, WORKFLOWS.md, requirements.txt, main.py)
- [x] Create basic HTML template (`templates/index.html`) mirroring donnitriosa.my.id
- [x] Create static assets (`static/css/style.css`, `static/js/main.js`)
- [x] Implement image processor module (`utils/image_processor.py`) using Pillow
- [x] Implement `POST /process/image` endpoint in `main.py`
- [x] Implement Vanilla JS Fetch API for image upload and Blob download
- [x] Implement Drag-and-Drop UI functionality
- [x] End-to-end testing for Image Mode

## Phase 2: PDF Mode
- [x] Implement PDF processor module (`utils/pdf_processor.py`) using PyMuPDF
- [x] Implement `POST /process/pdf` endpoint in `main.py`
- [x] Add PDF mode toggle/tab in UI (`index.html`)
- [x] Update JS to handle PDF processing requests
- [x] End-to-end testing for PDF Mode

## Phase 3: Image Compression Quality
- [x] Add `quality: int` parameter to `process_image()` in `utils/image_processor.py`
- [x] Add `quality: int = Form(default=85, ge=1, le=100)` to `POST /process/image` in `main.py`
- [x] Add quality range slider UI to `templates/index.html` (hidden for PNG)
- [x] Update JS to append `quality` to FormData and toggle visibility based on format
- [x] End-to-end testing for Image Compression

## Phase 4: Security & Optimization

- [x] Server-side magic bytes validation for uploaded files (`utils/validators.py`)
- [x] Per-IP rate limiting via `slowapi`
- [x] Batch image processing with ZIP download output (`POST /process/batch`)
- [x] PDF page splitting / extraction utility (`POST /process/pdf/split`)
