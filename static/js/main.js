/**
 * Reshift — Main Frontend Logic (Vanilla JS)
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. DOM Elements
    const body = document.body;
    const themeToggleBtn = document.getElementById("theme-toggle");
    const sunIcon = document.querySelector(".sun-icon");
    const moonIcon = document.querySelector(".moon-icon");

    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("image-file");
    const fileInfo = document.getElementById("file-info");
    const fileNameSpan = document.getElementById("file-name");
    const fileSizeSpan = document.getElementById("file-size");
    const btnRemoveFile = document.getElementById("btn-remove-file");

    const imagePreviewContainer = document.getElementById("image-preview-container");
    const imagePreview = document.getElementById("image-preview");
    const imageDimensions = document.getElementById("image-dimensions");
    const lockAspectRatio = document.getElementById("lock-aspect-ratio");

    const widthInput = document.getElementById("width");
    const heightInput = document.getElementById("height");
    const formatSelect = document.getElementById("format");
    const qualityGroup = document.getElementById("quality-group");
    const qualityInput = document.getElementById("quality");
    const qualityValue = document.getElementById("quality-value");
    const processBtn = document.getElementById("process-btn");

    const resultCard = document.getElementById("result-card");
    const resultText = document.getElementById("result-text");
    const downloadBtn = document.getElementById("download-btn");

    // Mode Switcher Elements
    const btnModeImage = document.getElementById("btn-mode-image");
    const btnModePdf = document.getElementById("btn-mode-pdf");
    const imagePanel = document.getElementById("image-panel");
    const pdfPanel = document.getElementById("pdf-panel");

    // PDF Elements
    const pdfDropZone = document.getElementById("pdf-drop-zone");
    const pdfFileInput = document.getElementById("pdf-file");
    const pdfFileInfo = document.getElementById("pdf-file-info");
    const pdfFileNameSpan = document.getElementById("pdf-file-name");
    const pdfFileSizeSpan = document.getElementById("pdf-file-size");
    const btnRemovePdf = document.getElementById("btn-remove-pdf");
    const pdfProcessBtn = document.getElementById("pdf-process-btn");
    const pdfSplitBtn = document.getElementById("pdf-split-btn");
    const pdfResultCard = document.getElementById("pdf-result-card");
    const pdfResultText = document.getElementById("pdf-result-text");
    const pdfDownloadBtn = document.getElementById("pdf-download-btn");

    // State Variables
    let selectedFiles = []; // Array of File objects for image mode
    let selectedPdfFile = null;
    let originalWidth = 0;
    let originalHeight = 0;

    // 2. Theme Toggle
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

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", toggleTheme);
    }

    // 3. Helper Functions
    function formatFileSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    function validateImageFile(file) {
        const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        if (!validTypes.includes(file.type)) {
            alert(`Unsupported file format: ${file.name}! Please upload PNG, JPEG, or WEBP.`);
            return false;
        }
        return true;
    }

    function handleFilesSelected(fileList) {
        const filesArray = Array.from(fileList);
        const validFiles = filesArray.filter(validateImageFile);

        if (validFiles.length === 0) return;

        if (validFiles.length > 20) {
            alert("Maximum 20 images allowed in batch processing.");
            selectedFiles = validFiles.slice(0, 20);
        } else {
            selectedFiles = validFiles;
        }

        if (selectedFiles.length === 1) {
            const singleFile = selectedFiles[0];
            fileNameSpan.textContent = singleFile.name;
            fileSizeSpan.textContent = formatFileSize(singleFile.size);

            const previewUrl = URL.createObjectURL(singleFile);
            imagePreview.src = previewUrl;

            const img = new Image();
            img.onload = () => {
                originalWidth = img.naturalWidth;
                originalHeight = img.naturalHeight;
                imageDimensions.textContent = `${originalWidth} × ${originalHeight} px`;
                imagePreviewContainer.style.display = "flex";

                widthInput.value = originalWidth;
                heightInput.value = originalHeight;
            };
            img.src = previewUrl;
        } else {
            const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
            fileNameSpan.textContent = `${selectedFiles.length} images selected`;
            fileSizeSpan.textContent = formatFileSize(totalSize);
            imagePreviewContainer.style.display = "none";
            widthInput.value = "";
            heightInput.value = "";
        }

        fileInfo.style.display = "flex";
        processBtn.removeAttribute("disabled");
        processBtn.textContent = selectedFiles.length > 1 ? "Process Batch (ZIP)" : "Process Image";
        resultCard.style.display = "none";
    }

    function removeSelectedFiles() {
        selectedFiles = [];
        originalWidth = 0;
        originalHeight = 0;
        fileInput.value = "";
        fileInfo.style.display = "none";
        imagePreview.src = "";
        imagePreviewContainer.style.display = "none";
        widthInput.value = "";
        heightInput.value = "";
        processBtn.setAttribute("disabled", "true");
        processBtn.textContent = "Process Image";
        resultCard.style.display = "none";
    }

    // 4. Aspect Ratio Lock Listener
    function initAspectRatioLock() {
        if (!widthInput || !heightInput || !lockAspectRatio) return;

        widthInput.addEventListener("input", () => {
            if (!lockAspectRatio.checked || !originalWidth || !originalHeight) return;
            const w = parseInt(widthInput.value, 10);
            if (!isNaN(w) && w > 0) {
                heightInput.value = Math.round((w * originalHeight) / originalWidth);
            } else {
                heightInput.value = "";
            }
        });

        heightInput.addEventListener("input", () => {
            if (!lockAspectRatio.checked || !originalWidth || !originalHeight) return;
            const h = parseInt(heightInput.value, 10);
            if (!isNaN(h) && h > 0) {
                widthInput.value = Math.round((h * originalWidth) / originalHeight);
            } else {
                widthInput.value = "";
            }
        });
    }

    // 5. Drag and Drop Zone Interactivity
    if (dropZone) {
        ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => e.preventDefault(), false);
        });

        ["dragenter", "dragover"].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add("drag-over"), false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove("drag-over"), false);
        });

        dropZone.addEventListener("drop", (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleFilesSelected(dt.files);
            }
        });

        dropZone.addEventListener("click", (e) => {
            if (e.target === fileInput) return;
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFilesSelected(e.target.files);
            }
        });
    }

    if (btnRemoveFile) {
        btnRemoveFile.addEventListener("click", removeSelectedFiles);
    }

    initAspectRatioLock();

    // Quality Slider Visibility
    function initQualitySlider() {
        if (!qualityInput || !qualityValue || !formatSelect || !qualityGroup) return;

        qualityInput.addEventListener("input", () => {
            qualityValue.textContent = qualityInput.value;
        });

        function updateQualityVisibility() {
            const fmt = formatSelect.value.toUpperCase();
            qualityGroup.style.display = (fmt === "PNG") ? "none" : "block";
        }

        formatSelect.addEventListener("change", updateQualityVisibility);
        updateQualityVisibility();
    }

    initQualitySlider();

    // 6. PDF Processing Functions & Listeners
    function handlePdfSelected(file) {
        if (!file || file.type !== "application/pdf") {
            alert("Invalid file type! Please upload a PDF document.");
            return;
        }
        selectedPdfFile = file;
        pdfFileNameSpan.textContent = file.name;
        pdfFileSizeSpan.textContent = formatFileSize(file.size);
        pdfFileInfo.style.display = "flex";
        pdfProcessBtn.removeAttribute("disabled");
        if (pdfSplitBtn) pdfSplitBtn.removeAttribute("disabled");
        pdfResultCard.style.display = "none";
    }

    function removeSelectedPdf() {
        selectedPdfFile = null;
        pdfFileInput.value = "";
        pdfFileInfo.style.display = "none";
        pdfProcessBtn.setAttribute("disabled", "true");
        if (pdfSplitBtn) pdfSplitBtn.setAttribute("disabled", "true");
        pdfResultCard.style.display = "none";
    }

    if (pdfDropZone) {
        ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
            pdfDropZone.addEventListener(eventName, (e) => e.preventDefault(), false);
        });

        ["dragenter", "dragover"].forEach(eventName => {
            pdfDropZone.addEventListener(eventName, () => pdfDropZone.classList.add("drag-over"), false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            pdfDropZone.addEventListener(eventName, () => pdfDropZone.classList.remove("drag-over"), false);
        });

        pdfDropZone.addEventListener("drop", (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handlePdfSelected(dt.files[0]);
            }
        });

        pdfDropZone.addEventListener("click", (e) => {
            if (e.target === pdfFileInput) return;
            pdfFileInput.click();
        });
    }

    if (pdfFileInput) {
        pdfFileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handlePdfSelected(e.target.files[0]);
            }
        });
    }

    if (btnRemovePdf) {
        btnRemovePdf.addEventListener("click", removeSelectedPdf);
    }

    // PDF Compress Listener
    if (pdfProcessBtn) {
        pdfProcessBtn.addEventListener("click", async () => {
            if (!selectedPdfFile) return;

            pdfProcessBtn.setAttribute("disabled", "true");
            pdfProcessBtn.textContent = "Compressing PDF...";
            pdfResultCard.style.display = "none";

            const formData = new FormData();
            formData.append("file", selectedPdfFile);

            try {
                const response = await fetch("/process/pdf", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    let errorMessage = "Failed to compress PDF.";
                    try {
                        const errJson = await response.json();
                        if (errJson && errJson.detail) errorMessage = errJson.detail;
                    } catch (e) {}
                    throw new Error(errorMessage);
                }

                const blob = await response.blob();
                const downloadUrl = URL.createObjectURL(blob);

                let filename = "document-Reshift.pdf";
                const disposition = response.headers.get("Content-Disposition");
                if (disposition && disposition.indexOf("attachment") !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, "");
                    }
                }

                pdfResultText.textContent = "PDF compressed successfully and ready to download.";
                pdfDownloadBtn.href = downloadUrl;
                pdfDownloadBtn.setAttribute("download", filename);
                pdfResultCard.style.display = "block";
                pdfResultCard.scrollIntoView({ behavior: "smooth" });

            } catch (error) {
                console.error("PDF Processing Error:", error);
                alert(`Error: ${error.message}`);
            } finally {
                pdfProcessBtn.removeAttribute("disabled");
                pdfProcessBtn.textContent = "Compress PDF";
            }
        });
    }

    // PDF Split Listener
    if (pdfSplitBtn) {
        pdfSplitBtn.addEventListener("click", async () => {
            if (!selectedPdfFile) return;

            pdfSplitBtn.setAttribute("disabled", "true");
            pdfSplitBtn.textContent = "Splitting PDF...";
            pdfResultCard.style.display = "none";

            const formData = new FormData();
            formData.append("file", selectedPdfFile);

            try {
                const response = await fetch("/process/pdf/split", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    let errorMessage = "Failed to split PDF.";
                    try {
                        const errJson = await response.json();
                        if (errJson && errJson.detail) errorMessage = errJson.detail;
                    } catch (e) {}
                    throw new Error(errorMessage);
                }

                const blob = await response.blob();
                const downloadUrl = URL.createObjectURL(blob);

                let filename = "document-Reshift-pages.zip";
                const disposition = response.headers.get("Content-Disposition");
                if (disposition && disposition.indexOf("attachment") !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, "");
                    }
                }

                pdfResultText.textContent = "PDF split into individual pages successfully (ZIP archive).";
                pdfDownloadBtn.href = downloadUrl;
                pdfDownloadBtn.setAttribute("download", filename);
                pdfResultCard.style.display = "block";
                pdfResultCard.scrollIntoView({ behavior: "smooth" });

            } catch (error) {
                console.error("PDF Split Error:", error);
                alert(`Error: ${error.message}`);
            } finally {
                pdfSplitBtn.removeAttribute("disabled");
                pdfSplitBtn.textContent = "Split Pages (ZIP)";
            }
        });
    }

    // Mode Switcher Handler
    function initModeSwitcher() {
        if (!btnModeImage || !btnModePdf || !imagePanel || !pdfPanel) return;

        btnModeImage.addEventListener("click", () => {
            btnModeImage.classList.add("active");
            btnModePdf.classList.remove("active");
            imagePanel.style.display = "flex";
            pdfPanel.style.display = "none";
        });

        btnModePdf.addEventListener("click", () => {
            btnModePdf.classList.add("active");
            btnModeImage.classList.remove("active");
            pdfPanel.style.display = "flex";
            imagePanel.style.display = "none";
        });
    }

    initModeSwitcher();

    // 7. Submit Image Processing Form (Single or Batch)
    if (processBtn) {
        processBtn.addEventListener("click", async () => {
            if (selectedFiles.length === 0) return;

            const isBatch = selectedFiles.length > 1;
            const endpoint = isBatch ? "/process/batch" : "/process/image";

            processBtn.setAttribute("disabled", "true");
            processBtn.textContent = isBatch ? "Processing Batch..." : "Processing Image...";
            resultCard.style.display = "none";

            const formData = new FormData();
            if (isBatch) {
                selectedFiles.forEach((file) => formData.append("files", file));
            } else {
                formData.append("file", selectedFiles[0]);
            }

            formData.append("output_format", formatSelect.value);
            formData.append("quality", qualityInput ? qualityInput.value : "85");

            const widthVal = widthInput.value.trim();
            const heightVal = heightInput.value.trim();
            if (widthVal) formData.append("width", widthVal);
            if (heightVal) formData.append("height", heightVal);

            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    body: formData
                });

                if (!response.ok) {
                    let errorMessage = "Failed to process image.";
                    try {
                        const errJson = await response.json();
                        if (errJson && errJson.detail) errorMessage = errJson.detail;
                    } catch (e) {}
                    throw new Error(errorMessage);
                }

                const blob = await response.blob();
                const downloadUrl = URL.createObjectURL(blob);

                let filename = isBatch ? "Reshift-batch.zip" : "";
                const disposition = response.headers.get("Content-Disposition");
                if (disposition && disposition.indexOf("attachment") !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, "");
                    }
                } else if (!isBatch) {
                    const ext = formatSelect.value.toLowerCase();
                    const origStem = selectedFiles[0] ? selectedFiles[0].name.replace(/\.[^/.]+$/, "") : "image";
                    filename = `${origStem}-Reshift.${ext === "jpeg" ? "jpg" : ext}`;
                }

                resultText.textContent = isBatch
                    ? "Batch images processed successfully into ZIP archive."
                    : "Image processed successfully and ready to download.";

                downloadBtn.href = downloadUrl;
                downloadBtn.setAttribute("download", filename);
                resultCard.style.display = "block";
                resultCard.scrollIntoView({ behavior: "smooth" });

            } catch (error) {
                console.error("Processing Error:", error);
                alert(`Error: ${error.message}`);
            } finally {
                processBtn.removeAttribute("disabled");
                processBtn.textContent = isBatch ? "Process Batch (ZIP)" : "Process Image";
            }
        });
    }
});
