"""Shared state TypedDict that flows through the LangGraph pipeline."""
from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class ATSState(TypedDict):
    # ─── Inputs ──────────────────────────────────────────────────
    jd_path: str
    resume_path: str
    linkedin_path: str
    job_title: str
    recruiter_id: str
    candidate_id: str
    scoring_job_id: str

    # ─── Extracted text ──────────────────────────────────────────
    jd_text: str
    resume_text: str
    linkedin_text: str

    # ─── Parser agent output ─────────────────────────────────────
    name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    resume_skills: List[str]
    resume_experience: List[Dict[str, Any]]
    resume_education: List[Dict[str, Any]]

    # ─── JD analysis ─────────────────────────────────────────────
    jd_required_skills: List[str]
    jd_preferred_skills: List[str]

    # ─── Scorer agent output ─────────────────────────────────────
    ats_score: Optional[float]
    skills_matched: List[str]
    skills_not_matched: List[str]
    main_summary: Optional[str]
    pros: List[str]
    cons: List[str]

    # ─── LinkedIn agent output ───────────────────────────────────
    linkedin_match_score: Optional[float]
    linkedin_summary: Optional[str]
    linkedin_flag: Optional[str]          # "green" | "red"

    # ─── Embeddings (for Faiss) ──────────────────────────────────
    resume_embedding: Optional[List[float]]
    jd_embedding: Optional[List[float]]
    linkedin_embedding: Optional[List[float]]

    # ─── Errors ──────────────────────────────────────────────────
    errors: List[str]

    # ─── Raw extracted data ──────────────────────────────────────
    extracted_data: Dict[str, Any]
