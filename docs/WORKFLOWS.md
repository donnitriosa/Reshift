# Reshift — Workflows & Pipelines

## 1. Application Startup Sequence

```text
[Uvicorn Start]
      |
      v
[FastAPI lifespan event]
      |
      v
[cleanup_tmp()] ---> Wipes contents of ./workspace/tmp/
      |
      v
[App Ready] ---> Mounts /static, configures Jinja2Templates
```

## 2. Image Processing Pipeline (Phase 1)

```text
[Browser]
    |-- User selects image & configures settings (width, height, format)
    |-- JS Fetch API POST (multipart/form-data)
    |
[FastAPI Route: POST /process/image]
    |-- Receive UploadFile & Form fields
    |
[utils/image_processor.py]
    |-- Open image in Pillow (BytesIO)
    |-- Apply resize (maintain aspect ratio if needed)
    |-- Enforce RGB mode (if JPEG target)
    |-- Save to new BytesIO buffer
    |
[FastAPI Response]
    |-- Return StreamingResponse (binary blob)
    |
[Browser]
    |-- Receive binary stream
    |-- Convert to Blob -> URL.createObjectURL()
    |-- Enable 'Download' button in UI
```

## 3. PDF Processing Pipeline (Phase 2)

```text
[Browser]
    |-- User selects PDF
    |-- JS Fetch API POST (multipart/form-data)
    |
[FastAPI Route: POST /process/pdf]
    |-- Receive UploadFile
    |
[utils/pdf_processor.py]
    |-- Open PDF with PyMuPDF (fitz)
    |-- Iterate pages -> compress images
    |-- Strip unused metadata
    |-- Decision: In-memory vs Disk?
    |   |-- (Large file) -> Save to workspace/tmp/uuid.pdf
    |   |-- (Small file) -> Save to BytesIO
    |
[FastAPI Response]
    |-- Return StreamingResponse or FileResponse
    |
[Browser]
    |-- Receive binary stream
    |-- Convert to Blob -> URL.createObjectURL()
    |-- Enable 'Download' button in UI
```
