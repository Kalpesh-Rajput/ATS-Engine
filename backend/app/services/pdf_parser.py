"""Utility service for extracting raw text from PDF and Word documents."""
from pathlib import Path

import pdfplumber

try:
    import docx
except ImportError:  # pragma: no cover
    docx = None


def extract_text_from_document(path: str) -> str:
    """Extract text from a supported document type."""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(path).strip()
    if ext == ".docx":
        return _extract_docx(path).strip()
    return ""


def extract_text_from_pdf(path: str) -> str:
    """Backward-compatible alias for PDF text extraction."""
    return extract_text_from_document(path)


def _extract_pdf(path: str) -> str:
    text = _extract_pdfplumber(path)
    if not text.strip():
        text = _extract_pymupdf(path)
    return text


def _extract_pdfplumber(path: str) -> str:
    try:
        with pdfplumber.open(path) as pdf:
            pages = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    pages.append(page_text)
            return "\n".join(pages)
    except Exception:
        return ""


def _extract_pymupdf(path: str) -> str:
    try:
        import fitz  # pymupdf
        doc = fitz.open(path)
        pages = [page.get_text() for page in doc]
        doc.close()
        return "\n".join(pages)
    except Exception:
        return ""


def _extract_docx(path: str) -> str:
    if docx is None:
        return ""
    try:
        document = docx.Document(path)
        return "\n".join([p.text for p in document.paragraphs if p.text])
    except Exception:
        return ""
