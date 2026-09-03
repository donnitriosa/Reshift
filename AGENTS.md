# Utility Web App — Agent Instructions

Build a clean, robust, and fast monolith web application for Image/PDF resizing and format conversion. Powered by Python, FastAPI, Jinja2, Pillow, PyMuPDF, and Vanilla JavaScript (Fetch API). The UI design directly mirrors the aesthetics of `donnitriosa.my.id`.

---

## Workflow Rules

1. Read `TASKS.md` before every session to orient to current state.
2. Never rework items marked `[x]` in `TASKS.md` unless explicitly instructed.
3. Update `TASKS.md` immediately after testing a feature.
4. Never attempt to write the entire codebase in a single response.
5. Create `TASKS.md`, `docs/ARCHITECTURE.md`, `docs/WORKFLOWS.md` during project init.

---

## Skills & Caveman Mode

- **GLOBAL:** All prompts processed as if `"Use caveman mode full"` is injected.
- Before ANY coding task, invoke and read: `using-superpowers`, `karpathy-guidelines`, `caveman`.
- Use `using-superpowers` to route to other relevant skills per task.

---

## Utility Modes & Phased Flow

### Phase 1: Image Mode
- **Engine:** Uses `Pillow` (PIL) for image manipulation.
- **Resize Capabilities:** Accepts target width and height. Maintains aspect ratio if only one dimension is provided.
- **Format Options:** `PNG`, `JPEG`, `WEBP`.
- **Memory Handling:** Processing occurs in-memory using `io.BytesIO` to avoid disk I/O bottlenecks. RGB mode conversion is strictly enforced before saving as JPEG.
- **Output:** Returns binary file blob immediately to the frontend.

### Phase 2: PDF Mode
- **Engine:** Uses `PyMuPDF` (fitz).
- **Optimization Strategy:** Reduces file size by compressing internal images and stripping unused metadata.
- **Memory Handling:** Large files may be staged temporarily in `workspace/tmp/` before returning to the user, mimicking a staging flow.

### Phase 3: Image Compression Quality
- **Parameter:** `quality: int` (range 1–100, default 85). Passed to Pillow `img.save(quality=quality)`.
- **Scope:** Applies to JPEG and WEBP only. PNG is lossless — quality parameter is ignored.
- **UI:** Range slider `<input type="range" min="1" max="100">` shown/hidden based on format selection.
- **Validation:** Clamped to 1–100 server-side via `Form(default=85, ge=1, le=100)`.

### Phase 4: Frontend & Execution Flow
- **Upload:** Dual support for Drag-and-Drop and traditional Browse Button.
- **Execution:** Uses Vanilla JavaScript and `Fetch API` for asynchronous `POST` requests. No page reloads.
- **Download Strategy:** Backend returns a binary file. Frontend processes the response as a `Blob`, generates an Object URL, and updates a "Download" button for the user.

### Phase 5: Image Mode Enhancement
Focus: Improve Image Mode UX and capabilities.

#### 5.1 — UI Reorder: All-in-One Button Leftmost
- **Current order:** `Compress | Resize | Convert | All-in-One`
- **Target order:** `All-in-One | Compress | Resize | Convert`
- **Scope:** HTML button order in `templates/index.html` only. No backend changes.

#### 5.2 — Smart Compress (No Quality Percentage)
- **Current behavior:** Compress action exposes quality slider (1–100) and passes percentage to Pillow.
- **Target behavior:** Compress action uses **best lossless/near-lossless algorithm per format** without user-facing quality slider.
  - **JPEG:** Use Pillow `optimize=True` with `quality=95` (visually lossless). No slider exposed.
  - **WEBP:** Use `lossless=True` with `method=6` (best compression).
  - **PNG:** Use `optimize=True` with `compress_level=9` (max zlib compression, fully lossless).
- **UI change:** When Compress is selected, **hide the quality slider entirely**. The slider remains visible for Convert and All-in-One modes.
- **Backend:** Add `smart_compress: bool` parameter to `process_image()`. When `True`, override quality/save kwargs with optimal settings per format.
- **API contract:** `POST /process/image` and `POST /process/batch` accept optional `smart_compress` Form field (default `false`). Frontend sends `smart_compress=true` when action is "compress".

#### 5.3 — PNG Compression Support
- **Current behavior:** PNG is lossless; quality parameter is ignored. Compress mode with PNG does nothing meaningful.
- **Target behavior:** PNG compression uses `optimize=True` + `compress_level=9` for maximum lossless size reduction.
- **Implementation:** Handled as part of 5.2 smart compress. When format is PNG:
  - `img.save(buffer, format="PNG", optimize=True, compress_level=9)`
- **Validation:** Compare output file size vs input — if output ≥ input, return original bytes (no point returning a larger file).

#### 5.4 — Crop Image Feature
- **New action button:** Add `Crop` to the Image Utilities action group.
- **Button order after this phase:** `All-in-One | Compress | Resize | Convert | Crop` (All-in-One stays leftmost).
- **UI:** When Crop is selected, show crop parameters:
  - `left` (x offset), `top` (y offset), `right`, `bottom` — all in pixels.
  - Input fields with placeholder text explaining the crop box coordinates.
  - Live preview of crop dimensions if single image is uploaded (text display: "Crop area: W×H px").
- **Backend:**
  - Add `crop_image(image, left, top, right, bottom)` function in `utils/image_processor.py`.
  - Validate: `left < right`, `top < bottom`, all values ≥ 0, `right ≤ image.width`, `bottom ≤ image.height`.
  - Uses `image.crop((left, top, right, bottom))`.
- **API:** `POST /process/image` accepts optional `crop_left`, `crop_top`, `crop_right`, `crop_bottom` Form fields. Crop is applied **before** resize (if both present in All-in-One).
- **Batch support:** `POST /process/batch` also accepts crop parameters — same crop box applied uniformly to all images. Validation skips images smaller than the crop box.

---

## Critical Constraints

### Python Ecosystem
- `.venv` is mandatory. Never touch the global Python environment.
- Use `pip` with a `requirements.txt` file for dependency management.
- Required core dependencies: `fastapi`, `uvicorn`, `jinja2`, `python-multipart`, `Pillow`, `PyMuPDF`.
- All temporary runtime assets (if any) go to `./workspace/tmp/`. Never `/tmp/` or `%TEMP%`.

### Security & Hardening (Future Work)
- **Magic Bytes Validation:** Validate file headers (magic bytes) server-side in addition to MIME types.
- **Rate Limiting:** Add per-IP rate limiting (e.g., `slowapi`) if deployed publicly.
- **Batch Processing:** Support multi-file upload returning a ZIP archive.

### Architecture & Interfaces
- **Monolith Design:** Backend (FastAPI) and Frontend (Jinja2 Templates) are strictly housed in the same project directory.
- **No Heavy JS Frameworks:** Use Vanilla JS. Do not introduce React, Vue, or heavy CSS frameworks like Bootstrap/Tailwind unless overriding the custom Hugo CSS.
- **Design Parity:** HTML/CSS must mimic the layout, typography, and styling of `donnitriosa.my.id`.

### Cache & Purge
- Startup: `cleanup_tmp()` wipes `workspace/tmp/` to ensure no leftovers from previous sessions.

---

## Python Standards

- **Constants:** Define core configurations (e.g., supported formats, max file sizes) in a dedicated constants or config file.
- **Type Hints:** Every function fully annotated. `X | None` (not Optional). `from __future__ import annotations`. 
- **FastAPI Standards:** Use `UploadFile` and `File` for incoming binary data. Use `Form` for accompanying text data.
- **Exceptions:** Catch explicit exceptions (e.g., `PIL.UnidentifiedImageError`) and return user-friendly JSON error responses. No bare `except:`. Chain with `raise X from Y`.
- **Paths:** `pathlib.Path` only. No `os.path.join` or string concat.
- **Function design:** Max 40 lines. One function = one thing. Guard clauses, max 3 nesting levels.
- **Resources:** `with` blocks for all open/close lifecycles (e.g., opening images).
- **Toolchain:** Code should be clean and PEP-8 compliant.

---

## Non-Negotiable Rules

1. **No stubs.** Never use `# ... rest of the code`, bare `pass`, or `# TODO`. Every file must be complete, production-ready, fully typed.
2. **Never auto-run pipeline.** Provide exact commands to test (e.g., `uvicorn main:app --reload`) and wait for user feedback.
3. **No Cross-Origin (CORS) complexity.** Since this is a monolith utilizing Jinja2, the API and Web UI share the same origin. Do not implement complex CORS middleware unless requested.
4. **Never use system temp dirs.** All temporary files must stay in `./workspace/tmp/`.

---

## Directory Tree

```text
monolith-utility-app/
├── main.py              # Entry point: FastAPI router and endpoint definitions
├── requirements.txt     # Python dependencies
├── TASKS.md             # Project roadmap and task tracker
├── docs/                # Architecture and workflow documentation
│   ├── ARCHITECTURE.md
│   └── WORKFLOWS.md
├── utils/               # Helper modules (image_processor.py, pdf_processor.py)
├── static/              # Static assets (mirrors Hugo site assets)
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
├── templates/           # Jinja2 HTML files
│   └── index.html       
└── workspace/
    └── tmp/             # Staging area for large PDF processing
```

## References

| File | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | Module map, data flow, workspace layout |
| `docs/WORKFLOWS.md` | Pipeline flow diagrams, operational sequences |
| `TASKS.md` | Current project state — read before every session |
| `main.py` | Entry point — FastAPI routing and template rendering |
| `templates/index.html` | Core UI bridging custom CSS and JavaScript |
| `static/js/main.js` | Drag-and-drop and Fetch API logic |
| `utils` |/Isolated processing modules for Image (Pillow) and PDF (PyMuPDF) |
