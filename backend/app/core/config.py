from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_ENV: str = "development"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # Faiss Vector DB
    FAISS_INDEX_PATH: str = "vector_indices/candidates.faiss"
    FAISS_METADATA_PATH: str = "vector_indices/candidates_metadata.pkl"

    # LLM
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GROQ_MAX_TOKENS: int = 2048

    # OpenRouter (OpenAI-compatible)
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_MODEL: str | None = None

    # Embeddings
    EMBEDDING_MODEL: str = "nomic-ai/nomic-embed-text-v1.5"

    # Pipeline performance tuning
    # Windows Celery often runs with `--pool=solo`; parallelism is achieved via threads inside tasks.
    CANDIDATE_PIPELINE_WORKERS: int = 4
    PIPELINE_FAST_MODE: bool = True
    SCORER_USE_EMBEDDINGS: bool = True
    LINKEDIN_USE_EMBEDDINGS: bool = True

    # Files
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    @property
    def max_file_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
