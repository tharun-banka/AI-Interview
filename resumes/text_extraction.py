from io import BytesIO

from docx import Document
from pypdf import PdfReader


def extract_resume_text(file_bytes: bytes, extension: str) -> str:
    ext = extension.lower().lstrip(".")
    if ext == "txt":
        return file_bytes.decode("utf-8", errors="replace").strip()
    if ext == "pdf":
        reader = PdfReader(BytesIO(file_bytes))
        parts = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n".join(parts).strip()
    if ext == "docx":
        document = Document(BytesIO(file_bytes))
        return "\n".join(paragraph.text for paragraph in document.paragraphs).strip()
    raise ValueError("Unsupported file type. Upload PDF, DOCX, or TXT.")
