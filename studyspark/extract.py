"""Pull plain text out of uploaded study material (PDF, DOCX, TXT, Markdown)."""

from __future__ import annotations

import io
from pathlib import Path

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


class ExtractionError(ValueError):
    """Raised when a file can't be turned into usable text."""


def extract_text(filename: str, data: bytes) -> str:
    """Return the text content of an uploaded file.

    Raises ExtractionError for unsupported, oversized, empty or unreadable files.
    """
    if len(data) > MAX_UPLOAD_BYTES:
        raise ExtractionError("File is larger than 10 MB.")
    ext = Path(filename or "").suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ExtractionError(
            f"Unsupported file type '{ext or 'unknown'}'. Use PDF, DOCX, TXT or MD."
        )

    try:
        if ext == ".pdf":
            text = _from_pdf(data)
        elif ext == ".docx":
            text = _from_docx(data)
        else:
            text = data.decode("utf-8", errors="replace")
    except ExtractionError:
        raise
    except Exception as exc:  # corrupt files raise many different errors
        raise ExtractionError(f"Couldn't read that {ext[1:].upper()} file.") from exc

    if not text.strip():
        raise ExtractionError(
            "No text found in the file. Scanned PDFs (images of pages) aren't supported."
        )
    return text


def _from_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        raise ExtractionError("That PDF is password-protected.")
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _from_docx(data: bytes) -> str:
    import docx

    document = docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in document.paragraphs)
