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

## Phase 5: Image Mode Enhancement

### 5.1 — UI Reorder: All-in-One Leftmost
- [x] Verify button order in `templates/index.html`
- [x] Move All-in-One to leftmost position: `All-in-One | Compress | Resize | Convert | Crop`
- [x] Update `action-btn-group` grid to 5 columns (after Crop is added)

### 5.2 — Smart Compress (No Quality Slider)
- [x] Add `smart_compress_image()` function in `utils/image_processor.py`
  - JPEG: `optimize=True`, `quality=95` (visually lossless)
  - WEBP: `lossless=True`, `method=6` (best compression)
  - PNG: `optimize=True`, `compress_level=9` (max zlib)
- [x] Add `smart_compress` optional Form field to `POST /process/image` in `main.py`
- [x] Add `smart_compress` optional Form field to `POST /process/batch` in `main.py`
- [x] Update JS: when Compress action selected, hide quality slider, send `smart_compress=true`
- [x] Return original bytes if compressed output ≥ input size (size guard)
- [x] End-to-end testing for Smart Compress (JPEG, WEBP, PNG)

### 5.3 — PNG Compression Support
- [x] Handled via 5.2 smart compress — PNG uses `optimize=True` + `compress_level=9`
- [x] Verify PNG compress produces smaller output than raw input
- [x] Test with various PNG files (transparent, opaque, large, small)

### 5.4 — Crop Image Feature
- [x] Add `crop_image(image, left, top, right, bottom)` in `utils/image_processor.py`
  - Validate bounds: `left < right`, `top < bottom`, within image dimensions
  - Uses `image.crop((left, top, right, bottom))`
- [x] Integrate crop into `process_image()` pipeline (crop before resize)
- [x] Add `crop_left`, `crop_top`, `crop_right`, `crop_bottom` Form fields to `POST /process/image`
- [x] Add crop Form fields to `POST /process/batch` (uniform crop, skip undersized images)
- [x] Add `Crop` button to UI action group: `All-in-One | Compress | Resize | Convert | Crop`
- [x] Add crop input fields in HTML (left, top, right, bottom) with `data-for="crop all"`
- [x] Add crop dimension preview text ("Crop area: W×H px")
- [x] Update JS to send crop parameters and toggle crop settings visibility
- [x] Update CSS for 5-column action button grid
- [x] End-to-end testing for Crop (single + batch)
