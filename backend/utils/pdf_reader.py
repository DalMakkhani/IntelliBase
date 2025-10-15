from typing import List, Tuple
from pypdf import PdfReader


def extract_text_from_pdf(path: str) -> str:
    """Extract all text from a PDF file.

    Returns a single string with all pages concatenated.
    """
    reader = PdfReader(path)
    all_text = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
            all_text.append(text)
        except Exception as e:
            print(f"⚠️  Warning: Could not extract text from page {i}: {e}")
            all_text.append("")
    
    return "\n\n".join(all_text)


def extract_text_from_pdf_with_pages(path: str) -> List[Tuple[int, str]]:
    """Extract text per page from a PDF file.

    Returns a list of (page_number, text).
    """
    reader = PdfReader(path)
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        pages.append((i, text))
    return pages


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Simple chunking by characters with overlap.

    Returns list of text chunks.
    """
    if not text:
        return []
    chunks = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap if end < length else end
    return chunks
