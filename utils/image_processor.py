from __future__ import annotations

import io
from PIL import Image, UnidentifiedImageError

SUPPORTED_FORMATS: set[str] = {"PNG", "JPEG", "WEBP"}
MAX_FILE_BYTES: int = 20 * 1024 * 1024  # 20 MB


def validate_format(fmt: str) -> str:
    """Validates and normalizes output format string. Raises ValueError if unsupported."""
    normalized: str = fmt.upper()
    if normalized == "JPG":
        normalized = "JPEG"
    if normalized not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported format: {fmt}")
    return normalized


def resize_image(image: Image.Image, width: int | None, height: int | None) -> Image.Image:
    """Resize image. Maintains aspect ratio if only one dimension given."""
    if width is None and height is None:
        return image

    orig_width, orig_height = image.size

    # Target dimensions calculation preserving aspect ratio if one is None
    target_width: int = width if width is not None else int(orig_width * (height / orig_height))
    target_height: int = height if height is not None else int(orig_height * (width / orig_width))

    # Guard bounds
    target_width = max(1, target_width)
    target_height = max(1, target_height)

    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)


def process_image(
    file_bytes: bytes,
    output_format: str,
    width: int | None,
    height: int | None,
    quality: int = 85,
) -> tuple[io.BytesIO, str]:
    """
    Main image processing pipeline.
    Opens the image, resizes, converts to RGB if saving to JPEG, and writes to buffer.
    Quality parameter (1-100) applies to JPEG and WEBP outputs.
    """
    fmt: str = validate_format(output_format)

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            processed_img: Image.Image = resize_image(img, width, height)

            # Enforce RGB mode for JPEGs (JPEG doesn't support alpha channel)
            if fmt == "JPEG" and processed_img.mode in ("RGBA", "LA", "P"):
                processed_img = processed_img.convert("RGB")

            output_buffer: io.BytesIO = io.BytesIO()
            save_kwargs: dict[str, object] = {"format": fmt}
            if fmt in ("JPEG", "WEBP"):
                save_kwargs["quality"] = quality

            processed_img.save(output_buffer, **save_kwargs)
            output_buffer.seek(0)

            # Determine correct mime-type
            mime_type: str = f"image/{fmt.lower()}"

            return output_buffer, mime_type

    except UnidentifiedImageError as e:
        raise ValueError("Invalid image file format or corrupted file.") from e
