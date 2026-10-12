from __future__ import annotations

import io
import os
from PIL import Image, UnidentifiedImageError

SUPPORTED_FORMATS: set[str] = {"PNG", "JPEG", "WEBP"}
MAX_FILE_BYTES: int = int(os.environ.get("MAX_FILE_MB", "20")) * 1024 * 1024


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


def crop_image(
    image: Image.Image,
    left: int,
    top: int,
    right: int,
    bottom: int,
) -> Image.Image:
    """
    Crop image to specified bounding box.
    Validates coordinates are non-negative and within image dimensions.
    """
    img_w, img_h = image.size

    if left < 0 or top < 0:
        raise ValueError("Crop offsets must be non-negative.")
    if left >= right:
        raise ValueError(f"Crop left ({left}) must be less than right ({right}).")
    if top >= bottom:
        raise ValueError(f"Crop top ({top}) must be less than bottom ({bottom}).")
    if right > img_w:
        raise ValueError(f"Crop right ({right}) exceeds image width ({img_w}).")
    if bottom > img_h:
        raise ValueError(f"Crop bottom ({bottom}) exceeds image height ({img_h}).")

    return image.crop((left, top, right, bottom))


def smart_compress_image(
    image: Image.Image,
    fmt: str,
    original_size: int,
) -> io.BytesIO | None:
    """
    Apply best lossless/near-lossless compression per format.
    Returns compressed buffer, or None if output >= input size.
    """
    output_buffer: io.BytesIO = io.BytesIO()

    if fmt == "JPEG":
        save_img = image
        if save_img.mode in ("RGBA", "LA", "P"):
            save_img = save_img.convert("RGB")
        save_img.save(output_buffer, format="JPEG", optimize=True, quality=95)
    elif fmt == "WEBP":
        image.save(output_buffer, format="WEBP", lossless=True, method=6)
    elif fmt == "PNG":
        image.save(output_buffer, format="PNG", optimize=True, compress_level=9)
    else:
        image.save(output_buffer, format=fmt)

    compressed_size: int = output_buffer.tell()
    output_buffer.seek(0)

    if compressed_size >= original_size:
        return None

    return output_buffer


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
    Opens the image, crops (if crop params provided), resizes, converts to RGB if saving to JPEG, and writes to buffer.
    When smart_compress is True, uses optimal lossless settings per format instead of quality slider.
    """
    fmt: str = validate_format(output_format)

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            processed_img: Image.Image = img.copy()

            # Apply crop before resize
            if crop_left is not None and crop_top is not None and crop_right is not None and crop_bottom is not None:
                processed_img = crop_image(processed_img, crop_left, crop_top, crop_right, crop_bottom)

            # Apply resize
            processed_img = resize_image(processed_img, width, height)

            # Enforce RGB mode for JPEGs (JPEG doesn't support alpha channel)
            if fmt == "JPEG" and processed_img.mode in ("RGBA", "LA", "P"):
                processed_img = processed_img.convert("RGB")

            # Smart compress path
            if smart_compress:
                result = smart_compress_image(processed_img, fmt, len(file_bytes))
                if result is not None:
                    mime_type: str = f"image/{fmt.lower()}"
                    return result, mime_type
                # Fallback: compression didn't reduce size, return standard save
                output_buffer: io.BytesIO = io.BytesIO()
                processed_img.save(output_buffer, format=fmt)
                output_buffer.seek(0)
                return output_buffer, f"image/{fmt.lower()}"

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
