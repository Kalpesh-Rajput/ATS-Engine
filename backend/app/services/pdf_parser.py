"""Utility service for extracting raw text from PDF files."""
from pathlib import Path

import pdfplumber


def extract_text_from_pdf(path: str) -> str:
    """
    Extract all text from a PDF file using pdfplumber.
    Falls back to pymupdf if pdfplumber yields empty text.
    """
    text = _extract_pdfplumber(path)
    if not text.strip():
        text = _extract_pymupdf(path)
    return text.strip()


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
