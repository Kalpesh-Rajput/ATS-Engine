import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CandidateBase(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    job_applied: Optional[str] = None


class CandidateResponse(CandidateBase):
    id: uuid.UUID
    recruiter_id: uuid.UUID
    scoring_job_id: Optional[uuid.UUID] = None
    resume_path: Optional[str] = None
    linkedin_path: Optional[str] = None
    ats_score: Optional[float] = None
    linkedin_match_score: Optional[float] = None
    main_summary: Optional[str] = None
    linkedin_summary: Optional[str] = None
    linkedin_flag: Optional[str] = None
    skills_matched: Optional[List[str]] = None
    skills_not_matched: Optional[List[str]] = None
    pros: Optional[List[str]] = None
    cons: Optional[List[str]] = None
    status: str
    review_status: str
    client_name: Optional[str] = None
    job_role: Optional[str] = None
    created_at: datetime
    # KPI Evaluation fields
    evaluation_breakdown: Optional[dict] = None
    kpi_validation: Optional[dict] = None
    # Fit Analysis fields
    compatibility_assessment: Optional[dict] = None
    fit_reasoning: Optional[dict] = None
    key_signals: Optional[List[str]] = None
    strengths: Optional[List[str]] = None
    gaps: Optional[List[str]] = None
    fit_validation: Optional[dict] = None
    fit_analysis_debug: Optional[dict] = None

    model_config = {"from_attributes": True}


class CandidateListResponse(BaseModel):
    candidates: List[CandidateResponse]
    total: int
    page: int
    page_size: int


class ShortlistRequest(BaseModel):
    candidate_ids: List[uuid.UUID]
