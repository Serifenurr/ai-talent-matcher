"""
Buluta kaydet: metin → 384 boyutlu vektör (all-MiniLM-L6-v2) + metadata → Pinecone upsert.
Eski tuple API (id, vector, dict) yerine güncel sözlük formatı kullanılır.
"""
from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

load_dotenv()

INDEX_NAME = "cv-index"
MODEL_NAME = "all-MiniLM-L6-v2"

_default_model: SentenceTransformer | None = None
_default_index: Any = None


def _get_model() -> SentenceTransformer:
    global _default_model
    if _default_model is None:
        _default_model = SentenceTransformer(MODEL_NAME)
    return _default_model


def _get_index():
    global _default_index
    if _default_index is None:
        key = os.getenv("PINECONE_API_KEY")
        if not key:
            raise RuntimeError("PINECONE_API_KEY .env içinde tanımlı olmalı.")
        pc = Pinecone(api_key=key)
        _default_index = pc.Index(INDEX_NAME)
    return _default_index


def _pinecone_safe_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    """Pinecone yalnızca str, int, float, bool veya string listesi kabul eder; None atlanır."""
    out: dict[str, Any] = {}
    for k, v in (metadata or {}).items():
        if v is None:
            continue
        if isinstance(v, list):
            out[k] = [str(x) for x in v if x is not None]
        elif isinstance(v, (str, int, float, bool)):
            out[k] = v
        else:
            out[k] = str(v)
    return out


def save_to_cloud(
    file_name: str,
    text: str,
    metadata: dict[str, Any],
    *,
    vector: list[float] | None = None,
    model: SentenceTransformer | None = None,
    index=None,
) -> None:
    """
    Metni 384 boyutlu vektöre çevirir; Pinecone'a id + vektör + metadata olarak yükler.

    file_name: benzersiz vektör id (ör. dosya adından türetilmiş)
    text: ``vector`` verilmezse embed için kullanılan metin
    metadata: agent çıktısı (Pinecone konsolunda ``experience_years`` ile filtre)
    vector: Önceden hesaplanmış embedding (pipeline testi / çift encode önleme)

    model / index verilirse tekrar yükleme yapılmaz (upload_csv gibi toplu işlerde kullan).
    """
    m = model or _get_model()
    idx = index if index is not None else _get_index()
    if vector is not None:
        vec = vector
    else:
        vec = m.encode(text).tolist()
    meta = _pinecone_safe_metadata(metadata)

    idx.upsert(
        vectors=[
            {
                "id": file_name,
                "values": vec,
                "metadata": meta,
            }
        ]
    )
    print(f"Başarıyla kaydedildi: {file_name}")
