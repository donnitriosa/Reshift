# Image Mode Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Image Mode with smart lossless compression (no quality slider), PNG compression support, crop functionality, and correct UI button ordering.

**Architecture:** All image processing stays in `utils/image_processor.py` (Pillow). Backend endpoints in `main.py` accept new Form fields. Frontend in `static/js/main.js` + `templates/index.html` handles new UI controls. No new dependencies — Pillow already supports everything needed.

**Tech Stack:** Python 3.10+ / FastAPI / Pillow / Vanilla JS / CSS

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `utils/image_processor.py` | Modify | Add `smart_compress_image()`, `crop_image()`, integrate into `process_image()` pipeline |
| `main.py` | Modify | Add `smart_compress`, `crop_left/top/right/bottom` Form fields to both image endpoints |
| `templates/index.html` | Modify | Add Crop button, crop input fields, reorder action buttons to 5-column layout |
| `static/js/main.js` | Modify | Handle crop UI, send smart_compress/crop params, hide quality slider for compress |
| `static/css/style.css` | Modify | Update `.action-btn-group` grid to 5 columns |

---

## Task 1: Verify UI Button Order (All-in-One Rightmost)

**Files:**
- Inspect: `templates/index.html:80-85`

- [ ] **Step 1: Verify current button order in HTML**

Open `templates/index.html` and locate the `.action-btn-group` div. Current order:

```html
<button type="button" class="btn btn-secondary img-action-btn" data-action="compress" disabled>Compress</button>
<button type="button" class="btn btn-secondary img-action-btn" data-action="resize" disabled>Resize</button>
<button type="button" class="btn btn-secondary img-action-btn" data-action="convert" disabled>Convert</button>
<button type="button" class="btn btn-secondary img-action-btn" data-action="all" disabled>All-in-One</button>
```

All-in-One is already in the rightmost (last) position. No change needed for this sub-task. The Crop button (Task 5) will be inserted before All-in-One later.

- [ ] **Step 2: Commit confirmation**

```bash
git add AGENTS.md TASKS.md docs/superpowers/
git commit -m "docs: add Phase 5 Image Mode Enhancement plan and tasks"
```

---

## Task 2: Smart Compress — Backend (`utils/image_processor.py`)

**Files:**
- Modify: `utils/image_processor.py`

- [ ] **Step 1: Add `smart_compress_image()` function**

Add this function after `resize_image()` and before `process_image()` in `utils/image_processor.py`:

```python
def smart_compress_image(
    image: Image.Image,
    fmt: str,
    original_size: int,
) -> io.BytesIO:
    """
    Apply best lossless/near-lossless compression per format.
    Returns compressed buffer. Falls back to original bytes if output >= input.
    """
    output_buffer: io.BytesIO = io.BytesIO()

    if fmt == "JPEG":
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")
        image.save(output_buffer, format="JPEG", optimize=True, quality=95)
    elif fmt == "WEBP":
        image.save(output_buffer, format="WEBP", lossless=True, method=6)
    elif fmt == "PNG":
        image.save(output_buffer, format="PNG", optimize=True, compress_level=9)
    else:
        image.save(output_buffer, format=fmt)

    compressed_size: int = output_buffer.tell()
    output_buffer.seek(0)

    # Size guard: return original if compression didn't help
    if compressed_size >= original_size:
        return None

    return output_buffer
```

- [ ] **Step 2: Update `process_image()` signature to accept `smart_compress`**

Replace the existing `process_image()` function with:

```python
def process_image(
    file_bytes: bytes,
    output_format: str,
    width: int | None,
    height: int | None,
    quality: int = 85,
    smart_compress: bool = False,
    crop_left: int | None = None,
    crop_top: int | None = None,
    crop_right: int | None = None,
    crop_bottom: int | None = None,
) -> tuple[io.BytesIO, str]:
    """
    Main image processing pipeline.
    Order: open → crop → resize → save (smart compress or quality-based).
    """
    fmt: str = validate_format(output_format)

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            processed_img: Image.Image = img.copy()

            # Crop (applied before resize)
            if crop_left is not None and crop_top is not None and crop_right is not None and crop_bottom is not None:
                processed_img = crop_image(processed_img, crop_left, crop_top, crop_right, crop_bottom)

            # Resize
            processed_img = resize_image(processed_img, width, height)

            # Enforce RGB for JPEG
            if fmt == "JPEG" and processed_img.mode in ("RGBA", "LA", "P"):
                processed_img = processed_img.convert("RGB")

            # Smart compress path
            if smart_compress:
                result = smart_compress_image(processed_img, fmt, len(file_bytes))
                if result is not None:
                    mime_type: str = f"image/{fmt.lower()}"
                    return result, mime_type
                # Fallback: return original format with standard save
                output_buffer: io.BytesIO = io.BytesIO()
                processed_img.save(output_buffer, format=fmt)
                output_buffer.seek(0)
                mime_type = f"image/{fmt.lower()}"
                return output_buffer, mime_type

            # Standard quality-based save
            output_buffer = io.BytesIO()
            save_kwargs: dict[str, object] = {"format": fmt}
            if fmt in ("JPEG", "WEBP"):
                save_kwargs["quality"] = quality
            processed_img.save(output_buffer, **save_kwargs)
            output_buffer.seek(0)

            mime_type = f"image/{fmt.lower()}"
            return output_buffer, mime_type

    except UnidentifiedImageError as e:
        raise ValueError("Invalid image file format or corrupted file.") from e
```

- [ ] **Step 3: Run app and test smart compress manually**

```bash
cd /Volumes/Data_Drive_HD/Code/ular-besar/Reshift
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Test with `curl`:

```bash
# Smart compress a JPEG
curl -X POST http://localhost:8000/process/image \
  -F "file=@test-image.jpg" \
  -F "output_format=JPEG" \
  -F "smart_compress=true" \
  --output compressed.jpg

# Smart compress a PNG
curl -X POST http://localhost:8000/process/image \
  -F "file=@test-image.png" \
  -F "output_format=PNG" \
  -F "smart_compress=true" \
  --output compressed.png

# Compare file sizes
ls -la test-image.jpg compressed.jpg
ls -la test-image.png compressed.png
```

Expected: compressed files are ≤ original size. If compression didn't help, output equals a standard re-save.

- [ ] **Step 4: Commit**

```bash
git add utils/image_processor.py
git commit -m "feat: add smart compress and crop support to image processor"
```

---

## Task 3: Crop Image — Backend (`utils/image_processor.py`)

**Files:**
- Modify: `utils/image_processor.py`

- [ ] **Step 1: Add `crop_image()` function**

Add this function after `resize_image()` and before `smart_compress_image()`:

```python
def crop_image(
    image: Image.Image,
    left: int,
    top: int,
    right: int,
    bottom: int,
) -> Image.Image:
    """
    Crop image to the given bounding box.
    Validates that coordinates are within image bounds.
    """
    img_width, img_height = image.size

    if left < 0 or top < 0:
        raise ValueError("Crop coordinates must be non-negative.")
    if left >= right:
        raise ValueError(f"Crop left ({left}) must be less than right ({right}).")
    if top >= bottom:
        raise ValueError(f"Crop top ({top}) must be less than bottom ({bottom}).")
    if right > img_width:
        raise ValueError(f"Crop right ({right}) exceeds image width ({img_width}).")
    if bottom > img_height:
        raise ValueError(f"Crop bottom ({bottom}) exceeds image height ({img_height}).")

    return image.crop((left, top, right, bottom))
```

- [ ] **Step 2: Verify crop is already integrated in `process_image()`**

The crop call was added in Task 2's `process_image()` rewrite. Confirm this block exists:

```python
# Crop (applied before resize)
if crop_left is not None and crop_top is not None and crop_right is not None and crop_bottom is not None:
    processed_img = crop_image(processed_img, crop_left, crop_top, crop_right, crop_bottom)
```

- [ ] **Step 3: Test crop manually**

```bash
# Crop a 1000x800 image to a 500x400 region starting at (100, 50)
curl -X POST http://localhost:8000/process/image \
  -F "file=@test-image.jpg" \
  -F "output_format=JPEG" \
  -F "crop_left=100" \
  -F "crop_top=50" \
  -F "crop_right=600" \
  -F "crop_bottom=450" \
  --output cropped.jpg

# Verify dimensions with Python
python3 -c "from PIL import Image; img=Image.open('cropped.jpg'); print(img.size)"
```

Expected output: `(500, 400)`

- [ ] **Step 4: Test invalid crop bounds**

```bash
# left > right — should return 400 error
curl -s -X POST http://localhost:8000/process/image \
  -F "file=@test-image.jpg" \
  -F "output_format=JPEG" \
  -F "crop_left=600" \
  -F "crop_top=50" \
  -F "crop_right=100" \
  -F "crop_bottom=450" | python3 -m json.tool
```

Expected: `{"detail": "Crop left (600) must be less than right (100)."}`

- [ ] **Step 5: Commit**

```bash
git add utils/image_processor.py
git commit -m "feat: add crop_image function with bounds validation"
```

---

## Task 4: API Endpoints — Add New Form Fields (`main.py`)

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Update `process_image_endpoint` with new Form fields**

In `main.py`, update the `process_image_endpoint` function signature to add the new parameters after the existing `quality` parameter:

```python
@app.post("/process/image")
@limiter.limit("20/minute")
async def process_image_endpoint(
    request: Request,
    file: UploadFile = File(...),
    width: int | None = Form(default=None),
    height: int | None = Form(default=None),
    output_format: str = Form(...),
    quality: int = Form(default=85, ge=1, le=100),
    smart_compress: bool = Form(default=False),
    crop_left: int | None = Form(default=None, ge=0),
    crop_top: int | None = Form(default=None, ge=0),
    crop_right: int | None = Form(default=None, ge=1),
    crop_bottom: int | None = Form(default=None, ge=1),
) -> StreamingResponse:
```

- [ ] **Step 2: Update the `process_image()` call inside the endpoint**

Replace the existing `process_image()` call block (the `# 3. Process Image` section) with:

```python
        # 3. Process Image
        try:
            output_buffer, mime_type = process_image(
                file_bytes=file_bytes,
                output_format=output_format,
                width=width,
                height=height,
                quality=quality,
                smart_compress=smart_compress,
                crop_left=crop_left,
                crop_top=crop_top,
                crop_right=crop_right,
                crop_bottom=crop_bottom,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail="Internal image processing error.") from e
```

- [ ] **Step 3: Update `process_batch_endpoint` with new Form fields**

Update the batch endpoint signature:

```python
@app.post("/process/batch")
@limiter.limit("10/minute")
async def process_batch_endpoint(
    request: Request,
    files: list[UploadFile] = File(...),
    output_format: str = Form(...),
    quality: int = Form(default=85, ge=1, le=100),
    width: int | None = Form(default=None),
    height: int | None = Form(default=None),
    smart_compress: bool = Form(default=False),
    crop_left: int | None = Form(default=None, ge=0),
    crop_top: int | None = Form(default=None, ge=0),
    crop_right: int | None = Form(default=None, ge=1),
    crop_bottom: int | None = Form(default=None, ge=1),
) -> StreamingResponse:
```

- [ ] **Step 4: Update the `process_image()` call inside the batch loop**

Replace the `process_image()` call inside the `for idx, file in enumerate(files):` loop's try block:

```python
                try:
                    img_buffer, _ = process_image(
                        file_bytes=file_bytes,
                        output_format=output_format,
                        width=width,
                        height=height,
                        quality=quality,
                        smart_compress=smart_compress,
                        crop_left=crop_left,
                        crop_top=crop_top,
                        crop_right=crop_right,
                        crop_bottom=crop_bottom,
                    )
                    orig_stem = Path(file.filename or f"image_{idx + 1}").stem
                    out_filename = f"{orig_stem}-Reshift.{ext}"
                    zf.writestr(out_filename, img_buffer.getvalue())
                except Exception:
                    continue
```

- [ ] **Step 5: Test endpoints with curl**

```bash
# Single image with smart compress
curl -X POST http://localhost:8000/process/image \
  -F "file=@test-image.jpg" \
  -F "output_format=JPEG" \
  -F "smart_compress=true" \
  --output smart-compressed.jpg

# Single image with crop
curl -X POST http://localhost:8000/process/image \
  -F "file=@test-image.jpg" \
  -F "output_format=JPEG" \
  -F "crop_left=0" \
  -F "crop_top=0" \
  -F "crop_right=200" \
  -F "crop_bottom=200" \
  --output cropped.jpg

# Batch with smart compress
curl -X POST http://localhost:8000/process/batch \
  -F "files=@test-image.jpg" \
  -F "files=@test-image.png" \
  -F "output_format=JPEG" \
  -F "smart_compress=true" \
  --output batch-smart.zip
```

Expected: all responses return valid files, no 500 errors.

- [ ] **Step 6: Commit**

```bash
git add main.py
git commit -m "feat: add smart_compress and crop Form fields to image endpoints"
```

---

## Task 5: Frontend — Add Crop Button & Reorder to 5-Column Grid

**Files:**
- Modify: `templates/index.html:80-85`
- Modify: `static/css/style.css:467-477`

- [ ] **Step 1: Update HTML action button group**

In `templates/index.html`, replace the existing `.action-btn-group` div (lines 80-85):

```html
                <div class="action-btn-group" style="margin-bottom: 1.5rem;">
                    <button type="button" class="btn btn-secondary img-action-btn" data-action="compress" disabled>Compress</button>
                    <button type="button" class="btn btn-secondary img-action-btn" data-action="resize" disabled>Resize</button>
                    <button type="button" class="btn btn-secondary img-action-btn" data-action="convert" disabled>Convert</button>
                    <button type="button" class="btn btn-secondary img-action-btn" data-action="crop" disabled>Crop</button>
                    <button type="button" class="btn btn-secondary img-action-btn" data-action="all" disabled>All-in-One</button>
                </div>
```

- [ ] **Step 2: Add crop input fields to the settings area**

In `templates/index.html`, add these form groups inside `#image-settings-area` div, after the aspect ratio checkbox group and before the format select group:

```html
                        <div class="form-group" data-for="crop all">
                            <label for="crop-left">Left (X offset, px)</label>
                            <input type="number" id="crop-left" min="0" placeholder="0">
                        </div>
                        <div class="form-group" data-for="crop all">
                            <label for="crop-top">Top (Y offset, px)</label>
                            <input type="number" id="crop-top" min="0" placeholder="0">
                        </div>
                        <div class="form-group" data-for="crop all">
                            <label for="crop-right">Right (px)</label>
                            <input type="number" id="crop-right" min="1" placeholder="Width">
                        </div>
                        <div class="form-group" data-for="crop all">
                            <label for="crop-bottom">Bottom (px)</label>
                            <input type="number" id="crop-bottom" min="1" placeholder="Height">
                        </div>
                        <div class="form-group full-width" id="crop-preview-group" data-for="crop all" style="display: none;">
                            <span id="crop-dimensions" class="image-dimensions" style="font-size: 0.85rem;">Crop area: 0 × 0 px</span>
                        </div>
```

- [ ] **Step 3: Update CSS grid to 5 columns**

In `static/css/style.css`, replace the `.action-btn-group` rule (lines ~467-477):

```css
.action-btn-group {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem;
}

@media (max-width: 768px) {
    .action-btn-group {
        grid-template-columns: repeat(3, 1fr);
    }
}

@media (max-width: 576px) {
    .action-btn-group {
        grid-template-columns: repeat(2, 1fr);
    }
}
```

- [ ] **Step 4: Verify layout in browser**

```bash
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000` — verify 5 buttons display in a row on desktop, 3 on tablet, 2 on mobile. All-in-One is rightmost.

- [ ] **Step 5: Commit**

```bash
git add templates/index.html static/css/style.css
git commit -m "feat: add Crop button and 5-column action grid layout"
```

---

## Task 6: Frontend — JavaScript Logic for Smart Compress & Crop

**Files:**
- Modify: `static/js/main.js`

- [ ] **Step 1: Add crop DOM element references**

Add these after the existing Image Settings variable declarations (after line ~33, near `const imageSettingsArea`):

```javascript
    // Crop inputs
    const cropLeftInput = document.getElementById("crop-left");
    const cropTopInput = document.getElementById("crop-top");
    const cropRightInput = document.getElementById("crop-right");
    const cropBottomInput = document.getElementById("crop-bottom");
    const cropDimensions = document.getElementById("crop-dimensions");
    const cropPreviewGroup = document.getElementById("crop-preview-group");
```

- [ ] **Step 2: Add crop action text to `getActionBtnText()`**

Update the `getActionBtnText()` function map to include the crop action:

```javascript
    function getActionBtnText(action, isBatch) {
        const map = {
            compress: isBatch ? "Compress Batch (ZIP)" : "Compress Image",
            resize:   isBatch ? "Resize Batch (ZIP)"   : "Resize Image",
            convert:  isBatch ? "Convert Batch (ZIP)"  : "Convert Image",
            crop:     isBatch ? "Crop Batch (ZIP)"     : "Crop Image",
            all:      isBatch ? "Process Batch (ZIP)"  : "Process Image",
        };
        return map[action] || "Process Image";
    }
```

- [ ] **Step 3: Update `setImageAction()` to handle compress quality hiding and crop preview**

Replace the `setImageAction()` function entirely:

```javascript
    function setImageAction(action) {
        currentImageAction = action;

        // Highlight active button
        imgActionBtns.forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-action") === action);
        });

        // Toggle form groups visibility
        if (imageSettingsArea) {
            const formGroups = imageSettingsArea.querySelectorAll(".form-group");
            let anyVisible = false;
            formGroups.forEach(group => {
                const targets = (group.getAttribute("data-for") || "").split(" ");
                const show = targets.includes(action);
                if (show) anyVisible = true;
                group.style.display = show
                    ? (group.classList.contains("full-width") ? "block" : "flex")
                    : "none";

                // Quality group: hide entirely for compress mode; hide for PNG in convert/all
                if (group.id === "quality-group") {
                    if (action === "compress" || action === "crop") {
                        group.style.display = "none";
                    } else if (show && (action === "convert" || action === "all")) {
                        const fmt = formatSelect.value.toUpperCase();
                        group.style.display = (fmt === "PNG") ? "none" : "block";
                    }
                }
            });
            imageSettingsArea.style.display = anyVisible ? "grid" : "none";
        }

        // Auto-fill crop fields with full image dimensions for single file
        if ((action === "crop" || action === "all") && selectedFiles.length === 1 && originalWidth > 0) {
            if (cropLeftInput && !cropLeftInput.value) cropLeftInput.value = 0;
            if (cropTopInput && !cropTopInput.value) cropTopInput.value = 0;
            if (cropRightInput && !cropRightInput.value) cropRightInput.value = originalWidth;
            if (cropBottomInput && !cropBottomInput.value) cropBottomInput.value = originalHeight;
            updateCropPreview();
        }

        // Show process button when action selected and files uploaded
        if (processBtn) {
            const hasFiles = selectedFiles.length > 0;
            processBtn.style.display = "block";
            processBtn.disabled = !hasFiles;
            processBtn.textContent = getActionBtnText(action, selectedFiles.length > 1);
        }
    }
```

- [ ] **Step 4: Add crop preview update function**

Add this function after `setImageAction()`:

```javascript
    function updateCropPreview() {
        if (!cropLeftInput || !cropRightInput || !cropTopInput || !cropBottomInput || !cropDimensions || !cropPreviewGroup) return;
        const l = parseInt(cropLeftInput.value, 10) || 0;
        const t = parseInt(cropTopInput.value, 10) || 0;
        const r = parseInt(cropRightInput.value, 10) || 0;
        const b = parseInt(cropBottomInput.value, 10) || 0;
        const w = Math.max(0, r - l);
        const h = Math.max(0, b - t);
        cropDimensions.textContent = "Crop area: " + w + " × " + h + " px";
        cropPreviewGroup.style.display = (w > 0 && h > 0) ? "block" : "none";
    }
```

- [ ] **Step 5: Add crop input event listeners**

Add after the crop preview function:

```javascript
    [cropLeftInput, cropTopInput, cropRightInput, cropBottomInput].forEach(input => {
        if (input) input.addEventListener("input", updateCropPreview);
    });
```

- [ ] **Step 6: Update the form submit handler to send new parameters**

Replace the FormData building section inside the `processBtn` click handler (the `// Build parameters per action` block) with:

```javascript
            // Build parameters per action
            if (currentImageAction === "compress") {
                formData.append("output_format", origFormat);
                formData.append("smart_compress", "true");
            } else if (currentImageAction === "resize") {
                formData.append("output_format", origFormat);
                const w = widthInput.value.trim();
                const h = heightInput.value.trim();
                if (w) formData.append("width", w);
                if (h) formData.append("height", h);
            } else if (currentImageAction === "convert") {
                formData.append("output_format", formatSelect.value);
                formData.append("quality", qualityInput ? qualityInput.value : "85");
            } else if (currentImageAction === "crop") {
                formData.append("output_format", origFormat);
                const cl = cropLeftInput ? cropLeftInput.value.trim() : "";
                const ct = cropTopInput ? cropTopInput.value.trim() : "";
                const cr = cropRightInput ? cropRightInput.value.trim() : "";
                const cb = cropBottomInput ? cropBottomInput.value.trim() : "";
                if (cl) formData.append("crop_left", cl);
                if (ct) formData.append("crop_top", ct);
                if (cr) formData.append("crop_right", cr);
                if (cb) formData.append("crop_bottom", cb);
            } else {
                // All-in-One
                formData.append("output_format", formatSelect.value);
                formData.append("quality", qualityInput ? qualityInput.value : "85");
                const w = widthInput.value.trim();
                const h = heightInput.value.trim();
                if (w) formData.append("width", w);
                if (h) formData.append("height", h);
                const cl = cropLeftInput ? cropLeftInput.value.trim() : "";
                const ct = cropTopInput ? cropTopInput.value.trim() : "";
                const cr = cropRightInput ? cropRightInput.value.trim() : "";
                const cb = cropBottomInput ? cropBottomInput.value.trim() : "";
                if (cl) formData.append("crop_left", cl);
                if (ct) formData.append("crop_top", ct);
                if (cr) formData.append("crop_right", cr);
                if (cb) formData.append("crop_bottom", cb);
            }
```

- [ ] **Step 7: Reset crop fields on file removal**

In the `removeSelectedFiles()` function, add after `heightInput.value = "";`:

```javascript
        if (cropLeftInput) cropLeftInput.value = "";
        if (cropTopInput) cropTopInput.value = "";
        if (cropRightInput) cropRightInput.value = "";
        if (cropBottomInput) cropBottomInput.value = "";
        if (cropPreviewGroup) cropPreviewGroup.style.display = "none";
```

- [ ] **Step 8: Commit**

```bash
git add static/js/main.js
git commit -m "feat: JS logic for smart compress, crop UI, and crop preview"
```

---

## Task 7: End-to-End Testing

**Files:**
- No code changes — manual verification only

- [ ] **Step 1: Start the dev server**

```bash
cd /Volumes/Data_Drive_HD/Code/ular-besar/Reshift
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

- [ ] **Step 2: Test Smart Compress via UI**

1. Open `http://localhost:8000`
2. Upload a JPEG image
3. Click "Compress"
4. Verify: quality slider is **hidden**
5. Click "Compress Image"
6. Verify: download works, file size ≤ original

Repeat with PNG and WEBP files.

- [ ] **Step 3: Test Crop via UI**

1. Upload a single image
2. Click "Crop"
3. Verify: four crop input fields appear, auto-filled with image dimensions
4. Change values (e.g., left=100, top=100, right=500, bottom=400)
5. Verify: "Crop area: 400 × 300 px" text appears
6. Click "Crop Image"
7. Verify: downloaded image has the cropped dimensions

- [ ] **Step 4: Test All-in-One with crop**

1. Upload a single image
2. Click "All-in-One"
3. Verify: resize, format, quality, AND crop fields are all visible
4. Set crop values + resize values + format
5. Click "Process Image"
6. Verify: output is cropped, resized, and in the chosen format

- [ ] **Step 5: Test Batch with crop**

1. Upload multiple images
2. Click "Crop"
3. Set crop bounds smaller than all images
4. Click "Crop Batch (ZIP)"
5. Verify: ZIP contains all images cropped to the same region

- [ ] **Step 6: Test error states**

1. Crop with left ≥ right → should show error alert
2. Crop with bounds exceeding image dimensions → should show error alert
3. Batch crop where some images are too small for the crop box → those images should be skipped silently

- [ ] **Step 7: Test dark mode**

Toggle dark mode. Verify all new UI elements (crop fields, buttons) render correctly in dark theme.

- [ ] **Step 8: Test responsive layout**

Resize browser to mobile width. Verify:
- 5 buttons wrap to 2-per-row on mobile
- Crop fields stack properly
- Everything remains usable

- [ ] **Step 9: Final commit and TASKS.md update**

Mark all Phase 5 tasks as complete in `TASKS.md`:

```bash
git add TASKS.md
git commit -m "docs: mark Phase 5 Image Mode Enhancement as complete"
```

---

## Summary of Changes

| Component | What Changed |
| --- | --- |
| `utils/image_processor.py` | +`smart_compress_image()`, +`crop_image()`, updated `process_image()` pipeline |
| `main.py` | +`smart_compress`, +`crop_left/top/right/bottom` Form fields on both image endpoints |
| `templates/index.html` | +Crop button, +crop input fields, 5-button layout |
| `static/js/main.js` | +crop DOM refs, +crop preview, smart_compress send, updated FormData builder |
| `static/css/style.css` | 5-column grid, responsive breakpoints |
| `AGENTS.md` | +Phase 5 specification |
| `TASKS.md` | +Phase 5 task checklist |
