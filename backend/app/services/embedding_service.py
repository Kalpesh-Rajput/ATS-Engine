"""Singleton embedding service backed by sentence-transformers."""
from functools import lru_cache
import re
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import settings


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Load the model once and cache it for the process lifetime."""
    return SentenceTransformer(settings.EMBEDDING_MODEL, trust_remote_code=True)


def embed_texts(texts: List[str]) -> List[List[float]]:
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return embeddings.tolist()


def embed_single(text: str) -> List[float]:
    return embed_texts([text])[0]


def embed_document(text: str) -> List[float]:
    """
    Embed long documents by chunking + mean pooling.

    - Prefer paragraph/sentence-aware segmentation
    - Group segments into ~900-char chunks
    - Encode all chunks in one batch call
    - Mean-pool chunk vectors then return one final L2-normalized vector
    """
    t = text or ""
    t = t.strip()
    if not t:
        # Return a correctly shaped vector so callers that persist embeddings
        # (e.g. FAISS upsert) don't hit dimension mismatches.
        model = _get_model()
        vec = model.encode([""], normalize_embeddings=True, show_progress_bar=False)[0]
        return np.array(vec, dtype=np.float32).tolist()

    chunk_size = 900
    # Prefer semantic boundaries over raw character windows.
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", t) if p.strip()]
    if not paragraphs:
        paragraphs = [t]
    segments: List[str] = []
    for p in paragraphs:
        sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+|\n+", p)
            if s and s.strip()
        ]
        if not sentences:
            sentences = [p]
        segments.extend(sentences)

    chunks: List[str] = []
    cur: List[str] = []
    cur_len = 0
    for seg in segments:
        seg_len = len(seg)
        if cur and (cur_len + seg_len + 1 > chunk_size):
            chunks.append(" ".join(cur))
            cur = [seg]
            cur_len = seg_len
        else:
            cur.append(seg)
            cur_len += seg_len + (1 if cur_len else 0)
    if cur:
        chunks.append(" ".join(cur))

    model = _get_model()
    # Do NOT normalize per-chunk; we want mean pooling then normalize once.
    vectors = model.encode(chunks, normalize_embeddings=False, show_progress_bar=False)
    vectors = np.array(vectors, dtype=np.float32)
    mean_vec = vectors.mean(axis=0)

    norm = np.linalg.norm(mean_vec)
    if norm == 0:
        return mean_vec.tolist()
    mean_vec = mean_vec / norm
    return mean_vec.tolist()


def cosine_similarity(a: List[float], b: List[float]) -> float:
    va = np.array(a)
    vb = np.array(b)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)
