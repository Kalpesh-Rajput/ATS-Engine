"""Shared state TypedDict that flows through the LangGraph pipeline."""
from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict
from typing import Annotated

def dict_reducer(left: Any, right: Any) -> Any:
    """Reducer for dict fields - last writer wins."""
    if right is not None:
        return right
    return left

def list_reducer(left: Any, right: Any) -> Any:
    """Reducer for list fields that handles None values and avoids duplicates while preserving order."""
    if left is None:
        left = []
    if right is None:
        right = []

    # If lists contain dicts (unhashable), concatenate with deduplication by key fields
    if left and isinstance(left[0], dict):
        seen_keys = set()
        result = []
        for item in left + right:
            # Create a hashable key from dict items
            key = tuple(sorted((k, str(v)) for k, v in item.items()))
            if key not in seen_keys:
                seen_keys.add(key)
                result.append(item)
        return result

    # For hashable items (strings, numbers), use order-preserving deduplication
    seen = set()
    result = []
    for item in left + right:
        try:
            if item not in seen:
                seen.add(item)
                result.append(item)
        except TypeError:
            # Unhashable item - append it directly
            result.append(item)
    return result

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
    resume_skills: Annotated[List[str], list_reducer]
    resume_experience: Annotated[List[Dict[str, Any]], list_reducer]
    resume_education: Annotated[List[Dict[str, Any]], list_reducer]

    # ─── JD analysis ─────────────────────────────────────────────
    jd_required_skills: Annotated[List[str], list_reducer]
    jd_preferred_skills: Annotated[List[str], list_reducer]

    # ─── Scorer agent output ─────────────────────────────────────
    ats_score: Optional[float]
    skills_matched: Annotated[List[str], list_reducer]
    skills_not_matched: Annotated[List[str], list_reducer]
    main_summary: Optional[str]
    pros: Annotated[List[str], list_reducer]
    cons: Annotated[List[str], list_reducer]

    # ─── LinkedIn agent output ───────────────────────────────────
    linkedin_match_score: Optional[float]
    linkedin_summary: Optional[str]
    linkedin_flag: Optional[str]          # "green" | "orange" | "red"

    # ─── Embeddings (for Faiss) ──────────────────────────────────
    resume_embedding: Optional[List[float]]
    jd_embedding: Optional[List[float]]
    linkedin_embedding: Optional[List[float]]

    # ─── Errors ──────────────────────────────────────────────────
    errors: Annotated[List[str], list_reducer]
    output_blocked: Optional[bool]

    # ─── KPI Evaluation Agent output ─────────────────────────────
    evaluation_breakdown: Annotated[Optional[Dict[str, Any]], dict_reducer]      # KPI metrics
    kpi_validation: Annotated[Optional[Dict[str, Any]], dict_reducer]          # KPI validation results

    # ─── Fit Analysis Agent output ───────────────────────────────
    compatibility_assessment: Annotated[Optional[Dict[str, Any]], dict_reducer]  # Fit scores (technical, workplace, advancement)
    fit_reasoning: Annotated[Optional[Dict[str, str]], dict_reducer]             # LLM reasoning per metric
    key_signals: Annotated[Optional[List[str]], list_reducer]    # Quick assessment signals
    strengths: Annotated[Optional[List[str]], list_reducer]      # Derived strengths
    gaps: Annotated[Optional[List[str]], list_reducer]         # Identified gaps
    fit_validation: Annotated[Optional[Dict[str, Any]], dict_reducer]            # Fit validation results
    fit_analysis_debug: Annotated[Optional[Dict[str, Any]], dict_reducer]        # Debug info (LLM vs fallback)

    # ─── Raw extracted data ──────────────────────────────────────
    extracted_data: Annotated[Dict[str, Any], dict_reducer]
