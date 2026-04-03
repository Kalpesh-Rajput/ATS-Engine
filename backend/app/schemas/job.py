import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ScoringJobResponse(BaseModel):
    id: uuid.UUID
    recruiter_id: uuid.UUID
    celery_task_id: Optional[str] = None
    jd_path: Optional[str] = None
    job_title: Optional[str] = None
    status: str
    total_candidates: int
    processed_candidates: int
    failed_candidates: int
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class JobStatusResponse(BaseModel):
    job_id: uuid.UUID
    status: str
    progress_pct: float
    total: int
    processed: int
    failed: int
    completed_at: Optional[datetime] = None
