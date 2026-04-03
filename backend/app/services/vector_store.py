"""Faiss vector store service for semantic candidate search."""
import os
import pickle
from typing import List, Optional, Dict
import threading

import faiss
import numpy as np

from app.core.config import settings
from app.core.logging import logger

VECTOR_SIZE = 768  # nomic-embed-text-v1.5 output dimension
MAX_CANDIDATES = 100000  # Faiss index size


class FaissVectorStore:
    """Singleton Faiss vector store for candidate embeddings."""
    
    _instance = None
    _index = None
    _metadata = {}  # id -> metadata mapping
    _id_counter = 0
    _lock: threading.RLock
    _batch_depth: int
    _dirty: bool
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self._lock = threading.RLock()
        self._batch_depth = 0
        self._dirty = False
        self._ensure_dirs()
        self._load_or_create_index()
    
    def _ensure_dirs(self) -> None:
        """Ensure vector indices directory exists."""
        os.makedirs(os.path.dirname(settings.FAISS_INDEX_PATH) or ".", exist_ok=True)
    
    def _load_or_create_index(self) -> None:
        """Load existing Faiss index or create a new one."""
        if os.path.exists(settings.FAISS_INDEX_PATH):
            try:
                self._index = faiss.read_index(settings.FAISS_INDEX_PATH)
                logger.info("faiss_index_loaded", path=settings.FAISS_INDEX_PATH)
            except Exception as e:
                logger.warning("faiss_load_failed", error=str(e))
                self._create_new_index()
            
            # Load metadata
            if os.path.exists(settings.FAISS_METADATA_PATH):
                try:
                    with open(settings.FAISS_METADATA_PATH, "rb") as f:
                        data = pickle.load(f)
                        self._metadata = data.get("metadata", {})
                        self._id_counter = data.get("id_counter", 0)
                except Exception as e:
                    logger.warning("faiss_metadata_load_failed", error=str(e))
        else:
            self._create_new_index()
    
    def _create_new_index(self) -> None:
        """Create a new Faiss index."""
        # Create an L2 (Euclidean distance) index
        self._index = faiss.IndexFlatL2(VECTOR_SIZE)
        self._metadata = {}
        self._id_counter = 0
        logger.info("faiss_index_created", vector_size=VECTOR_SIZE)
    
    def _save_index(self) -> None:
        """Save the Faiss index and metadata to disk."""
        try:
            faiss.write_index(self._index, settings.FAISS_INDEX_PATH)
            with open(settings.FAISS_METADATA_PATH, "wb") as f:
                pickle.dump(
                    {"metadata": self._metadata, "id_counter": self._id_counter},
                    f
                )
            logger.debug("faiss_index_saved")
        except Exception as e:
            logger.error("faiss_save_failed", error=str(e))

    def begin_batch_upserts(self) -> None:
        """Disable per-upsert disk writes (flush at end)."""
        with self._lock:
            self._batch_depth += 1

    def flush_batch_upserts(self) -> None:
        """
        Re-enable disk writes and flush once if any vectors were added.
        Safe to call multiple times.
        """
        with self._lock:
            self._batch_depth = max(0, self._batch_depth - 1)
            if self._batch_depth == 0 and self._dirty:
                self._save_index()
                self._dirty = False
    
    def upsert(self, candidate_id: str, vector: List[float], payload: dict) -> None:
        """Add or update a candidate vector and metadata."""
        vector_array = np.array([vector], dtype=np.float32)
        with self._lock:
            # Convert candidate_id to numeric id for Faiss
            self._id_counter += 1
            numeric_id = self._id_counter

            # Store metadata with mapping
            self._metadata[numeric_id] = {
                "candidate_id": candidate_id,
                **payload,
            }

            # Add to index (in-memory)
            self._index.add(vector_array)
            self._dirty = True

            # Only write to disk if not in batch mode.
            if self._batch_depth == 0:
                self._save_index()
                self._dirty = False
        
        logger.debug("candidate_vector_upserted", candidate_id=candidate_id)
    
    def search(
        self,
        query_vector: List[float],
        recruiter_id: str,
        top_k: int = 10,
        min_score: float = 0.5,
        metadata_filters: Optional[Dict[str, object]] = None,
    ) -> List[dict]:
        """Search for similar candidates using cosine similarity."""
        if self._index.ntotal == 0:
            return []
        
        # Normalize query vector for cosine similarity
        query_array = np.array([query_vector], dtype=np.float32)
        # L2 normalization
        query_array = query_array / (np.linalg.norm(query_array, axis=1, keepdims=True) + 1e-8)
        
        # Normalize all stored vectors
        # Note: For true cosine similarity, vectors should be normalized
        # We'll search with standard L2 on normalized vectors
        distances, indices = self._index.search(query_array, min(top_k * 2, self._index.ntotal))
        
        results = []
        for idx, distance in zip(indices[0], distances[0]):
            if idx == -1:  # Invalid result
                continue
            
            metadata = self._metadata.get(idx + 1)  # Faiss uses 0-based indexing, our IDs are 1-based
            if not metadata:
                continue
            
            # Filter by recruiter_id
            if metadata.get("recruiter_id") != recruiter_id:
                continue

            # Optional metadata filter (e.g. session_id/scoring_job_id/profile_type)
            if metadata_filters:
                is_match = True
                for k, v in metadata_filters.items():
                    if metadata.get(k) != v:
                        is_match = False
                        break
                if not is_match:
                    continue
            
            # Convert L2 distance to similarity score (lower distance = higher similarity)
            # For normalized vectors: similarity = 1 - (distance^2 / 2)
            similarity = max(0, 1 - (distance ** 2) / 2)
            
            if similarity >= min_score:
                results.append({
                    "id": metadata["candidate_id"],
                    "score": float(similarity),
                    **{k: v for k, v in metadata.items() if k != "candidate_id"}
                })
        
        return results[:top_k]


# Global instance
_store = None


def _get_store() -> FaissVectorStore:
    """Get singleton Faiss vector store instance."""
    global _store
    if _store is None:
        _store = FaissVectorStore()
    return _store


def ensure_collection() -> None:
    """Ensure the vector store is initialized."""
    _get_store()
    logger.info("faiss_collection_ensured")


def upsert_candidate_vector(candidate_id: str, vector: List[float], payload: dict) -> None:
    """Upsert a candidate vector to the Faiss store."""
    store = _get_store()
    store.upsert(candidate_id, vector, payload)


def begin_batch_upserts() -> None:
    """Start a batch section to avoid per-upsert index writes."""
    store = _get_store()
    store.begin_batch_upserts()


def flush_batch_upserts() -> None:
    """Flush batched upserts (writes FAISS index once)."""
    store = _get_store()
    store.flush_batch_upserts()


def search_similar_candidates(
    query_vector: List[float],
    recruiter_id: str,
    top_k: int = 10,
    min_score: float = 0.5,
    metadata_filters: Optional[Dict[str, object]] = None,
) -> List[dict]:
    """Search for similar candidates using semantic similarity."""
    store = _get_store()
    return store.search(query_vector, recruiter_id, top_k, min_score, metadata_filters)

