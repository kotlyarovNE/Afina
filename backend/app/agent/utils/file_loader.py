from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple
import hashlib


# Lightweight, optional loaders

import pypdf  # type: ignore
import docx  # python-docx



def _sha256_bytes(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def _read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _read_pdf(path: Path) -> str:
    if pypdf is None:
        return "[PDF parser не установлен (pip install pypdf); возвращено пустое содержимое]"
    try:
        r = pypdf.PdfReader(str(path))
        txt = []
        for page in r.pages:
            txt.append(page.extract_text() or "")
        return "\n".join(txt).strip()
    except Exception:
        return "[Не удалось распарсить PDF]"


def _read_docx(path: Path) -> str:
    if docx is None:
        return "[DOCX парсер не установлен (pip install python-docx); возвращено пустое содержимое]"
    try:
        d = docx.Document(str(path))
        return "\n".join(p.text for p in d.paragraphs)
    except Exception:
        return "[Не удалось распарсить DOCX]"


def parse_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".rst", ".log"}:
        return _read_text_file(path)
    if suffix == ".pdf":
        return _read_pdf(path)
    if suffix in {".docx"}:
        return _read_docx(path)
    # Fallback — try text
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        try:
            data = path.read_bytes()
            return data.decode("utf-8", errors="ignore")
        except Exception:
            return "[Не удалось прочитать файл: неизвестный формат]"


def load_files(
    file_names: List[str],
    uploads_dir: Path,
    prev_hashes: Dict[str, str] | None = None,
) -> Tuple[Dict[str, str], Dict[str, str], bool]:
    """Load/parse files from uploads_dir.

    Returns (files, hashes, changed) where:
      - files  : {filename: content}
      - hashes : {filename: sha256_of_raw_bytes}
      - changed: True if any hash differs from prev_hashes
    """
    prev_hashes = prev_hashes or {}

    out_files: Dict[str, str] = {}
    out_hashes: Dict[str, str] = {}
    changed = False

    for name in file_names:
        p = uploads_dir / name
        print(f"Checking file: {name}, full path: {p}, exists: {p.exists()}")
        if not p.exists() or not p.is_file():
            print(f"File {name} not found or not a file at {p}")
            continue
        raw = p.read_bytes()
        h = _sha256_bytes(raw)
        out_hashes[name] = h
        if prev_hashes.get(name) != h:
            changed = True
        # If content may be huge, you can clip here if needed
        content = parse_file(p)
        print(f"Parsed file {name}, content length: {len(content)}, first 100 chars: {content[:100]}")
        out_files[name] = content

    # Also detect deleted files
    if set(prev_hashes.keys()) != set(out_hashes.keys()):
        changed = True

    print(out_files)
    return out_files, out_hashes, changed
