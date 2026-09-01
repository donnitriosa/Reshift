# Reshift — Architecture Overview

## Core Design Principles
- **Monolith Design:** FastAPI (Backend) and Jinja2 (Frontend) run within the same process. They share the same origin, eliminating the need for complex CORS configurations.
- **Minimal Dependencies:** Strict reliance on Vanilla JavaScript (no React/Vue) and core Python libraries (`Pillow`, `PyMuPDF`). Custom CSS mirroring `donnitriosa.my.id` (no heavy frameworks).
- **In-Memory First:** Image processing occurs strictly in-memory using `io.BytesIO`. Disk I/O is minimized to prevent bottlenecks.

## Data Flow
1. **Frontend:** User uploads file via Drag-and-Drop or Browse button.
2. **Transmission:** Vanilla JS `Fetch API` sends an asynchronous `POST` request (`multipart/form-data`) without reloading the page.
3. **Backend Processing:**
   - **Image Mode:** FastAPI receives `UploadFile`, processes it via Pillow in `BytesIO`, and returns a `StreamingResponse`.
   - **PDF Mode:** PyMuPDF compresses images and strips metadata. Large PDFs may temporarily utilize `workspace/tmp/` as a staging area.
4. **Download:** The browser receives the binary stream, converts it to a `Blob`, generates a local Object URL, and triggers/presents a download link.

## Directory Structure
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

## Workspace Management
The `workspace/tmp/` directory is strictly for temporary runtime assets (e.g., large PDF staging). It is automatically purged on application startup via the `cleanup_tmp()` function hooked to FastAPI's `lifespan` event.
