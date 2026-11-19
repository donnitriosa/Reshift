/**
 * Reshift — Main Frontend Logic (Vanilla JS)
 */

document.addEventListener("DOMContentLoaded", () => {
    // ── DOM Elements ──────────────────────────────────────────────────────
    const body = document.body;
    const themeToggleBtn = document.getElementById("theme-toggle");
    const sunIcon = document.querySelector(".sun-icon");
    const moonIcon = document.querySelector(".moon-icon");

    // Image Upload
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("image-file");
    const fileInfo = document.getElementById("file-info");
    const fileNameSpan = document.getElementById("file-name");
    const fileSizeSpan = document.getElementById("file-size");
    const btnRemoveFile = document.getElementById("btn-remove-file");

    // Image Preview
    const imagePreviewContainer = document.getElementById("image-preview-container");
    const imagePreview = document.getElementById("image-preview");
    const imageDimensions = document.getElementById("image-dimensions");

    // Image Settings
    const lockAspectRatio = document.getElementById("lock-aspect-ratio");
    const widthInput = document.getElementById("width");
    const heightInput = document.getElementById("height");
    const cropLeftInput = document.getElementById("crop-left");
    const cropTopInput = document.getElementById("crop-top");
    const cropRightInput = document.getElementById("crop-right");
    const cropBottomInput = document.getElementById("crop-bottom");
    const cropPreviewGroup = document.getElementById("crop-preview-group");
    const cropDimensions = document.getElementById("crop-dimensions");
    const cropOverlay = document.getElementById("crop-overlay");
    const formatSelect = document.getElementById("format");
    const qualityGroup = document.getElementById("quality-group");
    const qualityInput = document.getElementById("quality");
    const qualityValue = document.getElementById("quality-value");
    const processBtn = document.getElementById("process-btn");
    const imgActionBtns = document.querySelectorAll(".img-action-btn");
    const imageSettingsArea = document.getElementById("image-settings-area");

    // Image Result
    const resultCard = document.getElementById("result-card");
    const resultText = document.getElementById("result-text");
    const downloadBtn = document.getElementById("download-btn");

    // Mode Switcher
    const btnModeImage = document.getElementById("btn-mode-image");
    const btnModePdf = document.getElementById("btn-mode-pdf");
    const imagePanel = document.getElementById("image-panel");
    const pdfPanel = document.getElementById("pdf-panel");

    // PDF Elements
    const pdfDropZone = document.getElementById("pdf-drop-zone");
    const pdfFileInput = document.getElementById("pdf-file");
    const pdfFileInfo = document.getElementById("pdf-file-info");
    const pdfFileList = document.getElementById("pdf-file-list");
    const pdfFileNameSpan = document.getElementById("pdf-file-name");
    const pdfFileSizeSpan = document.getElementById("pdf-file-size");
    const btnRemovePdf = document.getElementById("btn-remove-pdf");
    const pdfPageRangeInput = document.getElementById("pdf-page-range");
    const pdfImageFormatSelect = document.getElementById("pdf-image-format");
    const pdfProcessBtn = document.getElementById("pdf-process-btn");
    const pdfSplitBtn = document.getElementById("pdf-split-btn");
    const pdfToImagesBtn = document.getElementById("pdf-to-images-btn");
    const pdfMergeBtn = document.getElementById("pdf-merge-btn");
    const pdfResultCard = document.getElementById("pdf-result-card");
    const pdfResultText = document.getElementById("pdf-result-text");
    const pdfDownloadBtn = document.getElementById("pdf-download-btn");

    // Error Banner
    const errorBanner = document.getElementById("error-banner");
    const errorBannerText = document.getElementById("error-banner-text");
    const errorBannerClose = document.getElementById("error-banner-close");

    // ── State ─────────────────────────────────────────────────────────────
    let selectedFiles = [];
    let selectedPdfFiles = [];
    let originalWidth = 0;
    let originalHeight = 0;
    let currentImageAction = null;
    let activePreviewUrl = null;
    let activeImageDownloadUrl = null;
    let activePdfDownloadUrl = null;

    // ── Theme Toggle ──────────────────────────────────────────────────────
    function toggleTheme() {
        if (body.classList.contains("dark")) {
            body.classList.remove("dark");
            body.classList.add("light");
            localStorage.setItem("pref-theme", "light");
            sunIcon.style.display = "block";
            moonIcon.style.display = "none";
        } else {
            body.classList.remove("light");
            body.classList.add("dark");
            localStorage.setItem("pref-theme", "dark");
            sunIcon.style.display = "none";
            moonIcon.style.display = "block";
        }
    }

    if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);

    // ── Helpers ───────────────────────────────────────────────────────────
    function showError(message) {
        if (!errorBanner || !errorBannerText) return;
        errorBannerText.textContent = message;
        errorBanner.style.display = "flex";
        errorBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function clearError() {
        if (!errorBanner || !errorBannerText) return;
        errorBanner.style.display = "none";
        errorBannerText.textContent = "";
    }

    if (errorBannerClose) errorBannerClose.addEventListener("click", clearError);

    function formatFileSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    function formatSizeComparison(inputBytes, outputBytes) {
        if (inputBytes > 0 && outputBytes < inputBytes) {
            const savedPct = Math.round(((inputBytes - outputBytes) / inputBytes) * 100);
            return formatFileSize(inputBytes) + " \u2192 " + formatFileSize(outputBytes) + " (-" + savedPct + "% saved)";
        }
        if (outputBytes === inputBytes) {
            return formatFileSize(outputBytes) + " (already optimal)";
        }
        return formatFileSize(inputBytes) + " \u2192 " + formatFileSize(outputBytes);
    }

    function getOriginalFormat(file) {
        if (!file) return "JPEG";
        const ext = file.name.split(".").pop().toUpperCase();
        if (ext === "PNG") return "PNG";
        if (ext === "WEBP") return "WEBP";
        if (ext === "JPG" || ext === "JPEG") return "JPEG";
        return "JPEG";
    }

    function validateImageFile(file) {
        const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        if (!validTypes.includes(file.type)) {
            showError("Unsupported file format: " + file.name + "! Please upload PNG, JPEG, or WEBP.");
            return false;
        }
        return true;
    }

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

    // ── Image Action Mode ─────────────────────────────────────────────────
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

                // Quality group: hide entirely for compress and crop mode; hide for PNG in convert/all
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

        // Auto-fill crop fields with image dimensions for single file
        if ((action === "crop" || action === "all") && selectedFiles.length === 1 && originalWidth > 0) {
            if (cropLeftInput && !cropLeftInput.value) cropLeftInput.value = 0;
            if (cropTopInput && !cropTopInput.value) cropTopInput.value = 0;
            if (cropRightInput && !cropRightInput.value) cropRightInput.value = originalWidth;
            if (cropBottomInput && !cropBottomInput.value) cropBottomInput.value = originalHeight;
            updateCropPreview();
        } else {
            renderCropOverlay();
        }

        // Show process button when action selected and files uploaded
        if (processBtn) {
            const hasFiles = selectedFiles.length > 0;
            processBtn.style.display = "block";
            processBtn.disabled = !hasFiles;
            processBtn.textContent = getActionBtnText(action, selectedFiles.length > 1);
        }
    }

    // Action button click handlers
    imgActionBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            setImageAction(btn.getAttribute("data-action"));
        });
    });

    // ── Interactive Visual Crop Overlay ──────────────────────────────────────
    function getRenderedScale() {
        if (!imagePreview || !originalWidth || !originalHeight) return { scaleX: 1, scaleY: 1, displayedW: 0, displayedH: 0 };
        const displayedW = imagePreview.clientWidth;
        const displayedH = imagePreview.clientHeight;
        return {
            scaleX: displayedW / originalWidth,
            scaleY: displayedH / originalHeight,
            displayedW,
            displayedH
        };
    }

    function renderCropOverlay() {
        if (!cropOverlay || !imagePreview) return;
        const show = (currentImageAction === "crop" || currentImageAction === "all") && selectedFiles.length === 1 && originalWidth > 0;
        if (!show) {
            cropOverlay.style.display = "none";
            return;
        }

        const { scaleX, scaleY, displayedW, displayedH } = getRenderedScale();
        if (displayedW === 0 || displayedH === 0) return;

        const l = (parseInt(cropLeftInput.value, 10) || 0) * scaleX;
        const t = (parseInt(cropTopInput.value, 10) || 0) * scaleY;
        const r = (parseInt(cropRightInput.value, 10) || originalWidth) * scaleX;
        const b = (parseInt(cropBottomInput.value, 10) || originalHeight) * scaleY;

        const imgRect = imagePreview.getBoundingClientRect();
        const stageRect = imagePreview.parentElement.getBoundingClientRect();
        const offsetX = imgRect.left - stageRect.left;
        const offsetY = imgRect.top - stageRect.top;

        cropOverlay.style.display = "block";
        cropOverlay.style.left = (offsetX + l) + "px";
        cropOverlay.style.top = (offsetY + t) + "px";
        cropOverlay.style.width = Math.max(10, r - l) + "px";
        cropOverlay.style.height = Math.max(10, b - t) + "px";
    }

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
        renderCropOverlay();
    }

    [cropLeftInput, cropTopInput, cropRightInput, cropBottomInput].forEach(input => {
        if (input) input.addEventListener("input", updateCropPreview);
    });

    window.addEventListener("resize", renderCropOverlay);
    if (imagePreview) imagePreview.addEventListener("load", renderCropOverlay);

    // Drag & Resize Pointer Handlers for Crop Overlay (mouse + touch)
    let isDraggingCrop = false;
    let dragMode = "move"; // 'move' or handle name e.g. 'nw'
    let startX = 0, startY = 0;
    let startL = 0, startT = 0, startR = 0, startB = 0;

    if (cropOverlay) {
        cropOverlay.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            isDraggingCrop = true;
            dragMode = e.target.getAttribute("data-handle") || "move";
            startX = e.clientX;
            startY = e.clientY;

            startL = parseInt(cropLeftInput.value, 10) || 0;
            startT = parseInt(cropTopInput.value, 10) || 0;
            startR = parseInt(cropRightInput.value, 10) || originalWidth;
            startB = parseInt(cropBottomInput.value, 10) || originalHeight;

            try { cropOverlay.setPointerCapture(e.pointerId); } catch (_) {}
            document.addEventListener("pointermove", onCropPointerMove);
            document.addEventListener("pointerup", onCropPointerUp);
            document.addEventListener("pointercancel", onCropPointerUp);
        });
    }

    function onCropPointerMove(e) {
        if (!isDraggingCrop) return;
        const { scaleX, scaleY } = getRenderedScale();
        if (scaleX === 0 || scaleY === 0) return;

        const deltaX = Math.round((e.clientX - startX) / scaleX);
        const deltaY = Math.round((e.clientY - startY) / scaleY);

        let newL = startL;
        let newT = startT;
        let newR = startR;
        let newB = startB;

        if (dragMode === "move") {
            const width = startR - startL;
            const height = startB - startT;
            newL = Math.max(0, Math.min(originalWidth - width, startL + deltaX));
            newT = Math.max(0, Math.min(originalHeight - height, startT + deltaY));
            newR = newL + width;
            newB = newT + height;
        } else {
            if (dragMode.includes("w")) newL = Math.max(0, Math.min(startR - 10, startL + deltaX));
            if (dragMode.includes("e")) newR = Math.min(originalWidth, Math.max(startL + 10, startR + deltaX));
            if (dragMode.includes("n")) newT = Math.max(0, Math.min(startB - 10, startT + deltaY));
            if (dragMode.includes("s")) newB = Math.min(originalHeight, Math.max(startT + 10, startB + deltaY));
        }

        cropLeftInput.value = newL;
        cropTopInput.value = newT;
        cropRightInput.value = newR;
        cropBottomInput.value = newB;
        updateCropPreview();
    }

    function onCropPointerUp() {
        isDraggingCrop = false;
        document.removeEventListener("pointermove", onCropPointerMove);
        document.removeEventListener("pointerup", onCropPointerUp);
        document.removeEventListener("pointercancel", onCropPointerUp);
    }

    // ── Image File Handling ────────────────────────────────────────────────
    function handleFilesSelected(fileList) {
        clearError();
        const filesArray = Array.from(fileList);
        const validFiles = filesArray.filter(validateImageFile);
        if (validFiles.length === 0) return;

        if (validFiles.length > 20) {
            showError("Maximum 20 images allowed in batch processing.");
            selectedFiles = validFiles.slice(0, 20);
        } else {
            selectedFiles = validFiles;
        }

        if (selectedFiles.length === 1) {
            const singleFile = selectedFiles[0];
            fileNameSpan.textContent = singleFile.name;
            fileSizeSpan.textContent = formatFileSize(singleFile.size);
            if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
            activePreviewUrl = URL.createObjectURL(singleFile);
            imagePreview.src = activePreviewUrl;
            const img = new Image();
            img.onload = () => {
                originalWidth = img.naturalWidth;
                originalHeight = img.naturalHeight;
                imageDimensions.textContent = originalWidth + " × " + originalHeight + " px";
                imagePreviewContainer.style.display = "flex";
                widthInput.value = originalWidth;
                heightInput.value = originalHeight;
                if (currentImageAction === "crop" || currentImageAction === "all") {
                    cropLeftInput.value = 0;
                    cropTopInput.value = 0;
                    cropRightInput.value = originalWidth;
                    cropBottomInput.value = originalHeight;
                    updateCropPreview();
                } else {
                    renderCropOverlay();
                }
            };
            img.src = activePreviewUrl;
        } else {
            if (activePreviewUrl) {
                URL.revokeObjectURL(activePreviewUrl);
                activePreviewUrl = null;
            }
            const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
            fileNameSpan.textContent = selectedFiles.length + " images selected";
            fileSizeSpan.textContent = formatFileSize(totalSize);
            imagePreviewContainer.style.display = "none";
            widthInput.value = "";
            heightInput.value = "";
        }

        fileInfo.style.display = "flex";

        // Enable action buttons
        imgActionBtns.forEach(btn => btn.removeAttribute("disabled"));

        // If action already selected, enable process button
        if (currentImageAction) {
            processBtn.disabled = false;
            processBtn.style.display = "block";
            processBtn.textContent = getActionBtnText(currentImageAction, selectedFiles.length > 1);
        }

        resultCard.style.display = "none";
    }

    function removeSelectedFiles() {
        clearError();
        selectedFiles = [];
        originalWidth = 0;
        originalHeight = 0;
        currentImageAction = null;
        if (activePreviewUrl) {
            URL.revokeObjectURL(activePreviewUrl);
            activePreviewUrl = null;
        }
        if (activeImageDownloadUrl) {
            URL.revokeObjectURL(activeImageDownloadUrl);
            activeImageDownloadUrl = null;
        }
        fileInput.value = "";
        fileInfo.style.display = "none";
        imagePreview.src = "";
        imagePreviewContainer.style.display = "none";
        widthInput.value = "";
        heightInput.value = "";
        if (cropLeftInput) cropLeftInput.value = "";
        if (cropTopInput) cropTopInput.value = "";
        if (cropRightInput) cropRightInput.value = "";
        if (cropBottomInput) cropBottomInput.value = "";
        if (cropPreviewGroup) cropPreviewGroup.style.display = "none";
        renderCropOverlay();

        // Disable & reset action buttons
        imgActionBtns.forEach(btn => {
            btn.setAttribute("disabled", "true");
            btn.classList.remove("active");
        });

        // Hide settings & process button
        if (imageSettingsArea) imageSettingsArea.style.display = "none";
        if (processBtn) {
            processBtn.setAttribute("disabled", "true");
            processBtn.style.display = "none";
        }
        resultCard.style.display = "none";
    }

    // ── Drag & Drop (Image) ───────────────────────────────────────────────
    if (dropZone) {
        ["dragenter", "dragover", "dragleave", "drop"].forEach(ev =>
            dropZone.addEventListener(ev, e => e.preventDefault(), false)
        );
        ["dragenter", "dragover"].forEach(ev =>
            dropZone.addEventListener(ev, () => dropZone.classList.add("drag-over"), false)
        );
        ["dragleave", "drop"].forEach(ev =>
            dropZone.addEventListener(ev, () => dropZone.classList.remove("drag-over"), false)
        );
        dropZone.addEventListener("drop", e => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) handleFilesSelected(dt.files);
        });
        dropZone.addEventListener("click", e => {
            if (e.target === fileInput) return;
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", e => {
            if (e.target.files && e.target.files.length > 0) handleFilesSelected(e.target.files);
        });
    }

    if (btnRemoveFile) btnRemoveFile.addEventListener("click", removeSelectedFiles);

    // ── Aspect Ratio Lock ─────────────────────────────────────────────────
    if (widthInput && heightInput && lockAspectRatio) {
        widthInput.addEventListener("input", () => {
            if (!lockAspectRatio.checked || !originalWidth || !originalHeight) return;
            const w = parseInt(widthInput.value, 10);
            heightInput.value = (!isNaN(w) && w > 0) ? Math.round((w * originalHeight) / originalWidth) : "";
        });
        heightInput.addEventListener("input", () => {
            if (!lockAspectRatio.checked || !originalWidth || !originalHeight) return;
            const h = parseInt(heightInput.value, 10);
            widthInput.value = (!isNaN(h) && h > 0) ? Math.round((h * originalWidth) / originalHeight) : "";
        });
    }

    // ── Quality Slider ────────────────────────────────────────────────────
    if (qualityInput && qualityValue) {
        qualityInput.addEventListener("input", () => {
            qualityValue.textContent = qualityInput.value;
        });
    }
    if (formatSelect) {
        formatSelect.addEventListener("change", () => {
            if (!currentImageAction) return;
            if (currentImageAction === "convert" || currentImageAction === "all") {
                const fmt = formatSelect.value.toUpperCase();
                if (qualityGroup) qualityGroup.style.display = (fmt === "PNG") ? "none" : "block";
            }
        });
    }

    // ── Mode Switcher ─────────────────────────────────────────────────────
    if (btnModeImage && btnModePdf && imagePanel && pdfPanel) {
        btnModeImage.addEventListener("click", () => {
            clearError();
            btnModeImage.classList.add("active");
            btnModePdf.classList.remove("active");
            imagePanel.style.display = "flex";
            pdfPanel.style.display = "none";
        });
        btnModePdf.addEventListener("click", () => {
            clearError();
            btnModePdf.classList.add("active");
            btnModeImage.classList.remove("active");
            pdfPanel.style.display = "flex";
            imagePanel.style.display = "none";
        });
    }

    // ── Image Processing Submit ────────────────────────────────────────────
    if (processBtn) {
        processBtn.addEventListener("click", async () => {
            if (selectedFiles.length === 0 || !currentImageAction) return;

            clearError();
            const isBatch = selectedFiles.length > 1;
            const endpoint = isBatch ? "/process/batch" : "/process/image";
            const origFormat = getOriginalFormat(selectedFiles[0]);

            processBtn.setAttribute("disabled", "true");
            processBtn.textContent = "Processing...";
            resultCard.style.display = "none";

            const formData = new FormData();
            if (isBatch) {
                selectedFiles.forEach(file => formData.append("files", file));
            } else {
                formData.append("file", selectedFiles[0]);
            }

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

            try {
                const response = await fetch(endpoint, { method: "POST", body: formData });

                if (!response.ok) {
                    let errorMessage = "Failed to process image.";
                    try {
                        const errJson = await response.json();
                        if (errJson && errJson.detail) errorMessage = errJson.detail;
                    } catch (_) {}
                    throw new Error(errorMessage);
                }

                const blob = await response.blob();
                if (activeImageDownloadUrl) URL.revokeObjectURL(activeImageDownloadUrl);
                activeImageDownloadUrl = URL.createObjectURL(blob);

                let filename = isBatch ? "Reshift-batch.zip" : "";
                const disposition = response.headers.get("Content-Disposition");
                if (disposition && disposition.indexOf("attachment") !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, "");
                    }
                } else if (!isBatch) {
                    const targetFmt = (currentImageAction === "compress" || currentImageAction === "resize") ? origFormat : formatSelect.value;
                    const ext = targetFmt.toLowerCase();
                    const origStem = selectedFiles[0] ? selectedFiles[0].name.replace(/\.[^/.]+$/, "") : "image";
                    filename = origStem + "-Reshift." + (ext === "jpeg" ? "jpg" : ext);
                }

                resultText.textContent = isBatch
                    ? "Batch processed (" + selectedFiles.length + " images, " + formatFileSize(blob.size) + " ZIP) \u2014 ready to download."
                    : "Processed: " + formatSizeComparison(selectedFiles[0].size, blob.size) + " \u2014 ready to download.";
                downloadBtn.href = activeImageDownloadUrl;
                downloadBtn.setAttribute("download", filename);
                resultCard.style.display = "block";
                resultCard.scrollIntoView({ behavior: "smooth" });

            } catch (error) {
                console.error("Processing Error:", error);
                showError("Error: " + error.message);
            } finally {
                processBtn.removeAttribute("disabled");
                processBtn.textContent = getActionBtnText(currentImageAction, isBatch);
            }
        });
    }

    // ── PDF File Handling ──────────────────────────────────────────────────
    function updatePdfButtonsState() {
        const isSingle = selectedPdfFiles.length === 1;
        const isMulti = selectedPdfFiles.length >= 2;
        if (pdfProcessBtn) pdfProcessBtn.disabled = !isSingle;
        if (pdfSplitBtn) pdfSplitBtn.disabled = !isSingle;
        if (pdfToImagesBtn) pdfToImagesBtn.disabled = !isSingle;
        if (pdfMergeBtn) pdfMergeBtn.disabled = !isMulti;
    }

    function renderPdfSelection() {
        updatePdfButtonsState();
        pdfResultCard.style.display = "none";

        if (selectedPdfFiles.length === 0) {
            pdfFileInfo.style.display = "none";
            if (pdfFileList) {
                pdfFileList.style.display = "none";
                pdfFileList.replaceChildren();
            }
            return;
        }

        pdfFileInfo.style.display = "flex";
        if (selectedPdfFiles.length === 1) {
            pdfFileNameSpan.textContent = selectedPdfFiles[0].name;
            pdfFileSizeSpan.textContent = formatFileSize(selectedPdfFiles[0].size) + " (drop/browse another PDF to merge)";
            if (pdfFileList) {
                pdfFileList.style.display = "none";
                pdfFileList.replaceChildren();
            }
            return;
        }

        const totalSize = selectedPdfFiles.reduce((acc, f) => acc + f.size, 0);
        pdfFileNameSpan.textContent = selectedPdfFiles.length + " PDF files queued for merge";
        pdfFileSizeSpan.textContent = formatFileSize(totalSize);

        if (!pdfFileList) return;
        pdfFileList.replaceChildren();
        selectedPdfFiles.forEach((file, idx) => {
            const li = document.createElement("li");
            li.className = "pdf-file-item";

            const left = document.createElement("div");
            left.className = "pdf-item-left";

            const indexSpan = document.createElement("span");
            indexSpan.className = "pdf-item-index";
            indexSpan.textContent = (idx + 1) + ".";

            const nameSpan = document.createElement("span");
            nameSpan.className = "file-name";
            nameSpan.textContent = file.name + " (" + formatFileSize(file.size) + ")";

            left.appendChild(indexSpan);
            left.appendChild(nameSpan);

            const actions = document.createElement("div");
            actions.className = "pdf-item-actions";

            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "btn-icon btn-order";
            upBtn.setAttribute("aria-label", "Move up");
            upBtn.textContent = "\u2191";
            upBtn.disabled = idx === 0;
            upBtn.addEventListener("click", () => {
                if (idx === 0) return;
                const tmp = selectedPdfFiles[idx - 1];
                selectedPdfFiles[idx - 1] = selectedPdfFiles[idx];
                selectedPdfFiles[idx] = tmp;
                renderPdfSelection();
            });

            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "btn-icon btn-order";
            downBtn.setAttribute("aria-label", "Move down");
            downBtn.textContent = "\u2193";
            downBtn.disabled = idx === selectedPdfFiles.length - 1;
            downBtn.addEventListener("click", () => {
                if (idx >= selectedPdfFiles.length - 1) return;
                const tmp = selectedPdfFiles[idx + 1];
                selectedPdfFiles[idx + 1] = selectedPdfFiles[idx];
                selectedPdfFiles[idx] = tmp;
                renderPdfSelection();
            });

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "btn-icon";
            delBtn.setAttribute("aria-label", "Remove file");
            delBtn.textContent = "\u00d7";
            delBtn.addEventListener("click", () => {
                selectedPdfFiles.splice(idx, 1);
                renderPdfSelection();
            });

            actions.appendChild(upBtn);
            actions.appendChild(downBtn);
            actions.appendChild(delBtn);

            li.appendChild(left);
            li.appendChild(actions);
            pdfFileList.appendChild(li);
        });
        pdfFileList.style.display = "flex";
    }

    function handlePdfSelected(fileList) {
        clearError();
        const filesArray = Array.from(fileList || []);
        const validFiles = filesArray.filter(f => f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")));
        if (validFiles.length === 0) {
            showError("Invalid file type! Please upload PDF document(s).");
            return;
        }
        const combined = selectedPdfFiles.concat(validFiles);
        if (combined.length > 20) {
            showError("Maximum 20 PDF files allowed for merging.");
            selectedPdfFiles = combined.slice(0, 20);
        } else {
            selectedPdfFiles = combined;
        }

        if (pdfFileInput) pdfFileInput.value = "";
        renderPdfSelection();
    }

    function removeSelectedPdf() {
        clearError();
        selectedPdfFiles = [];
        if (activePdfDownloadUrl) {
            URL.revokeObjectURL(activePdfDownloadUrl);
            activePdfDownloadUrl = null;
        }
        if (pdfFileInput) pdfFileInput.value = "";
        renderPdfSelection();
    }

    // ── Drag & Drop (PDF) ─────────────────────────────────────────────────
    if (pdfDropZone) {
        ["dragenter", "dragover", "dragleave", "drop"].forEach(ev =>
            pdfDropZone.addEventListener(ev, e => e.preventDefault(), false)
        );
        ["dragenter", "dragover"].forEach(ev =>
            pdfDropZone.addEventListener(ev, () => pdfDropZone.classList.add("drag-over"), false)
        );
        ["dragleave", "drop"].forEach(ev =>
            pdfDropZone.addEventListener(ev, () => pdfDropZone.classList.remove("drag-over"), false)
        );
        pdfDropZone.addEventListener("drop", e => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) handlePdfSelected(dt.files);
        });
        pdfDropZone.addEventListener("click", e => {
            if (e.target === pdfFileInput) return;
            pdfFileInput.click();
        });
    }

    if (pdfFileInput) {
        pdfFileInput.addEventListener("change", e => {
            if (e.target.files && e.target.files.length > 0) handlePdfSelected(e.target.files);
        });
    }

    if (btnRemovePdf) btnRemovePdf.addEventListener("click", removeSelectedPdf);

    // ── PDF Compress ──────────────────────────────────────────────────────
    if (pdfProcessBtn) {
        pdfProcessBtn.addEventListener("click", async () => {
            if (selectedPdfFiles.length !== 1) return;
            clearError();
            const targetPdf = selectedPdfFiles[0];
            pdfProcessBtn.setAttribute("disabled", "true");
            pdfProcessBtn.textContent = "Compressing PDF...";
            pdfResultCard.style.display = "none";

            const formData = new FormData();
            formData.append("file", targetPdf);

            try {
                const response = await fetch("/process/pdf", { method: "POST", body: formData });
                if (!response.ok) {
                    let msg = "Failed to compress PDF.";
                    try { const j = await response.json(); if (j && j.detail) msg = j.detail; } catch (_) {}
                    throw new Error(msg);
                }
                const blob = await response.blob();
                if (activePdfDownloadUrl) URL.revokeObjectURL(activePdfDownloadUrl);
                activePdfDownloadUrl = URL.createObjectURL(blob);
                let filename = "document-Reshift.pdf";
                const disposition = response.headers.get("Content-Disposition");
                if (disposition && disposition.indexOf("attachment") !== -1) {
                    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                    if (m && m[1]) filename = m[1].replace(/['"]/g, "");
                }
                pdfResultText.textContent = "PDF compressed: " + formatSizeComparison(targetPdf.size, blob.size) + " \u2014 ready to download.";
                pdfDownloadBtn.href = activePdfDownloadUrl;
                pdfDownloadBtn.setAttribute("download", filename);
                pdfResultCard.style.display = "block";
                pdfResultCard.scrollIntoView({ behavior: "smooth" });
            } catch (error) {
                console.error("PDF Processing Error:", error);
                showError("Error: " + error.message);
            } finally {
                updatePdfButtonsState();
                pdfProcessBtn.textContent = "Compress PDF";
            }
        });
    }

    // ── PDF Split ─────────────────────────────────────────────────────────
    if (pdfSplitBtn) {
        pdfSplitBtn.addEventListener("click", async () => {
            if (selectedPdfFiles.length !== 1) return;
            clearError();
            pdfSplitBtn.setAttribute("disabled", "true");
            pdfSplitBtn.textContent = "Splitting PDF...";
            pdfResultCard.style.display = "none";

            const formData = new FormData();
            formData.append("file", selectedPdfFiles[0]);
            const rangeVal = pdfPageRangeInput ? pdfPageRangeInput.value.trim() : "";
            if (rangeVal) formData.append("page_range", rangeVal);

            try {
                const response = await fetch("/process/pdf/split", { method: "POST", body: formData });
                if (!response.ok) {
                    let msg = "Failed to split PDF.";
                    try { const j = await response.json(); if (j && j.detail) msg = j.detail; } catch (_) {}
                    throw new Error(msg);
                }
                const blob = await response.blob();
                if (activePdfDownloadUrl) URL.revokeObjectURL(activePdfDownloadUrl);
                activePdfDownloadUrl = URL.createObjectURL(blob);
                let filename = "document-Reshift-pages.zip";
                const disposition = response.headers.get("Content-Disposition");
                if (disposition && disposition.indexOf("attachment") !== -1) {
                    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                    if (m && m[1]) filename = m[1].replace(/['"]/g, "");
                }
                pdfResultText.textContent = "PDF split into selected pages (" + formatFileSize(blob.size) + " ZIP) \u2014 ready to download.";
                pdfDownloadBtn.href = activePdfDownloadUrl;
                pdfDownloadBtn.setAttribute("download", filename);
                pdfResultCard.style.display = "block";
                pdfResultCard.scrollIntoView({ behavior: "smooth" });
            } catch (error) {
                console.error("PDF Split Error:", error);
                showError("Error: " + error.message);
            } finally {
                updatePdfButtonsState();
                pdfSplitBtn.textContent = "Split Pages (ZIP)";
            }
        });
    }

    // ── PDF to Images ─────────────────────────────────────────────────────
    if (pdfToImagesBtn) {
        pdfToImagesBtn.addEventListener("click", async () => {
            if (selectedPdfFiles.length !== 1) return;
            clearError();
            pdfToImagesBtn.setAttribute("disabled", "true");
            pdfToImagesBtn.textContent = "Rendering Images...";
            pdfResultCard.style.display = "none";

            const formData = new FormData();
            formData.append("file", selectedPdfFiles[0]);
            formData.append("output_format", pdfImageFormatSelect ? pdfImageFormatSelect.value : "PNG");
            const rangeVal = pdfPageRangeInput ? pdfPageRangeInput.value.trim() : "";
            if (rangeVal) formData.append("page_range", rangeVal);

            try {
                const response = await fetch("/process/pdf/to-images", { method: "POST", body: formData });
                if (!response.ok) {
                    let msg = "Failed to render PDF pages.";
                    try { const j = await response.json(); if (j && j.detail) msg = j.detail; } catch (_) {}
                    throw new Error(msg);
                }
                const blob = await response.blob();
                if (activePdfDownloadUrl) URL.revokeObjectURL(activePdfDownloadUrl);
                activePdfDownloadUrl = URL.createObjectURL(blob);
                let filename = "document-Reshift-images.zip";
                const disposition = response.headers.get("Content-Disposition");
                if (disposition && disposition.indexOf("attachment") !== -1) {
                    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                    if (m && m[1]) filename = m[1].replace(/['"]/g, "");
                }
                pdfResultText.textContent = "PDF pages rendered to images (" + formatFileSize(blob.size) + " ZIP) \u2014 ready to download.";
                pdfDownloadBtn.href = activePdfDownloadUrl;
                pdfDownloadBtn.setAttribute("download", filename);
                pdfResultCard.style.display = "block";
                pdfResultCard.scrollIntoView({ behavior: "smooth" });
            } catch (error) {
                console.error("PDF to Images Error:", error);
                showError("Error: " + error.message);
            } finally {
                updatePdfButtonsState();
                pdfToImagesBtn.textContent = "PDF to Images (ZIP)";
            }
        });
    }

    // ── PDF Merge ─────────────────────────────────────────────────────────
    if (pdfMergeBtn) {
        pdfMergeBtn.addEventListener("click", async () => {
            if (selectedPdfFiles.length < 2) return;
            clearError();
            pdfMergeBtn.setAttribute("disabled", "true");
            pdfMergeBtn.textContent = "Merging PDFs...";
            pdfResultCard.style.display = "none";

            const formData = new FormData();
            selectedPdfFiles.forEach(file => formData.append("files", file));

            try {
                const response = await fetch("/process/pdf/merge", { method: "POST", body: formData });
                if (!response.ok) {
                    let msg = "Failed to merge PDFs.";
                    try { const j = await response.json(); if (j && j.detail) msg = j.detail; } catch (_) {}
                    throw new Error(msg);
                }
                const blob = await response.blob();
                if (activePdfDownloadUrl) URL.revokeObjectURL(activePdfDownloadUrl);
                activePdfDownloadUrl = URL.createObjectURL(blob);
                let filename = "Reshift-merged.pdf";
                const disposition = response.headers.get("Content-Disposition");
                if (disposition && disposition.indexOf("attachment") !== -1) {
                    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                    if (m && m[1]) filename = m[1].replace(/['"]/g, "");
                }
                pdfResultText.textContent = "Merged " + selectedPdfFiles.length + " PDFs (" + formatFileSize(blob.size) + ") \u2014 ready to download.";
                pdfDownloadBtn.href = activePdfDownloadUrl;
                pdfDownloadBtn.setAttribute("download", filename);
                pdfResultCard.style.display = "block";
                pdfResultCard.scrollIntoView({ behavior: "smooth" });
            } catch (error) {
                console.error("PDF Merge Error:", error);
                showError("Error: " + error.message);
            } finally {
                updatePdfButtonsState();
                pdfMergeBtn.textContent = "Merge PDFs";
            }
        });
    }

    // ── Floating Button Clearance ─────────────────────────────────────────
    // Lift the Trakteer button by however much the footer has scrolled into
    // view, so it never covers the footer text. `bottom` is set inline: the
    // widget appends its own stylesheet at draw time, and an inline style
    // wins regardless of stylesheet order.
    const appFooter = document.getElementById("appFooter");
    const BASE_BOTTOM = 20; // matches Trakteer's own floating offset
    let floatingBtn = null;

    function updateFloatingClearance() {
        if (!floatingBtn || !appFooter) return;
        const footerVisible = window.innerHeight - appFooter.getBoundingClientRect().top;
        const lift = Math.max(0, Math.round(footerVisible));
        floatingBtn.style.setProperty("bottom", (BASE_BOTTOM + lift) + "px", "important");
    }

    // The widget inserts its container asynchronously after the deferred
    // script runs, so wait for it before measuring.
    const floatingBtnPoll = setInterval(() => {
        floatingBtn = document.querySelector(".trbtn-overlay-container.floating-right");
        if (floatingBtn) {
            clearInterval(floatingBtnPoll);
            updateFloatingClearance();
        }
    }, 100);

    window.addEventListener("scroll", updateFloatingClearance, { passive: true });
    window.addEventListener("resize", updateFloatingClearance);
});
