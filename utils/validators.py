from __future__ import annotations

MAGIC_BYTES: dict[str, list[bytes]] = {
    "PNG": [b"\x89PNG\r\n\x1a\n"],
    "JPEG": [b"\xff\xd8\xff"],
    "WEBP": [b"RIFF"],  # RIFF header; WEBP check at offset 8
    "PDF": [b"%PDF-"],
}


def validate_magic_bytes(data: bytes, file_type: str) -> None:
    """
    Validates file magic bytes against expected file type signature.
    file_type can be 'PNG', 'JPEG', 'JPG', 'WEBP', or 'PDF'.
    Raises ValueError if magic bytes mismatch.
    """
    fmt = file_type.upper()
    if fmt == "JPG":
        fmt = "JPEG"

    if fmt not in MAGIC_BYTES:
        raise ValueError(f"Unsupported format for validation: {file_type}")

    if fmt == "WEBP":
        # WEBP has 'RIFF' at 0..4 and 'WEBP' at 8..12
        if len(data) < 12 or not (data.startswith(b"RIFF") and data[8:12] == b"WEBP"):
            raise ValueError("File content does not match WEBP image format.")
        return

    expected_signatures = MAGIC_BYTES[fmt]
    if not any(data.startswith(sig) for sig in expected_signatures):
        raise ValueError(f"File content does not match expected {fmt} format signature.")


def detect_file_type(data: bytes) -> str:
    """
    Detects supported file type from magic bytes.
    Returns 'PNG', 'JPEG', 'WEBP', or 'PDF'.
    Raises ValueError if format is unrecognized.
    """
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    if data.startswith(b"\xff\xd8\xff"):
        return "JPEG"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "WEBP"
    if data.startswith(b"%PDF-"):
        return "PDF"
    raise ValueError("Unrecognized file format or corrupted file header.")
