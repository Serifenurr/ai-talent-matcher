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
    out: dict[str, Any] = {}
    for k, v in (metadata or {}).items():
        if v is None:
            continue
        if k == "experience_years":
            try:
                out[k] = float(v)
            except:
                out[k] = 0.0
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
