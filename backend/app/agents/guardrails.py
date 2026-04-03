"""Reusable guardrails for ATS pipeline quality and safety checks."""
import re
from typing import Any


_PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+all\s+previous\s+instructions",
    r"disregard\s+the\s+above",
    r"reveal\s+(the\s+)?system\s+prompt",
    r"developer\s+message",
    r"jailbreak",
    r"bypass\s+guardrails",
    r"do\s+anything\s+now",
]

_TOXIC_MARKERS = [
    "idiot",
    "stupid",
    "useless",
    "hate",
]

_BIAS_MARKERS = [
    "too old",
    "too young",
    "male candidate",
    "female candidate",
    "married",
    "pregnant",
    "religion",
    "caste",
]

_SENSITIVE_PATTERNS = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),  # SSN-like
    re.compile(r"\b(?:\+?\d{1,3}[ -]?)?(?:\d[ -]?){9,12}\b"),  # phone-like
]
_EMAIL_PATTERN = re.compile(r"\b[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9.\-]+\b")


def has_prompt_injection(text: str) -> bool:
    t = (text or "").lower()
    return any(re.search(p, t, flags=re.IGNORECASE) for p in _PROMPT_INJECTION_PATTERNS)


def _is_list_of_strings(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(v, str) for v in value)


def validate_input_guardrails(
    *,
    jd_text: str,
    resume_text: str,
    job_title: str | None = None,
    filename_hints: list[str] | None = None,
) -> list[str]:
    errors: list[str] = []
    if not (jd_text or "").strip():
        errors.append("input_guardrail_failed: jd_text_empty")
    if not (resume_text or "").strip():
        errors.append("input_guardrail_failed: resume_text_empty")

    scan_inputs = [jd_text or "", resume_text or "", job_title or ""]
    scan_inputs.extend(filename_hints or [])
    for chunk in scan_inputs:
        if has_prompt_injection(chunk):
            errors.append("input_guardrail_failed: prompt_injection_suspected")
            break
    return errors


def validate_process_guardrails(state: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(state.get("resume_skills", []), list):
        errors.append("process_guardrail_failed: resume_skills_not_list")
    if not isinstance(state.get("resume_experience", []), list):
        errors.append("process_guardrail_failed: resume_experience_not_list")
    if not isinstance(state.get("resume_education", []), list):
        errors.append("process_guardrail_failed: resume_education_not_list")
    if not isinstance(state.get("jd_required_skills", []), list):
        errors.append("process_guardrail_failed: jd_required_skills_not_list")
    if not isinstance(state.get("jd_preferred_skills", []), list):
        errors.append("process_guardrail_failed: jd_preferred_skills_not_list")
    if not state.get("name") and not state.get("email"):
        errors.append("process_guardrail_warning: missing_name_and_email")
    return errors


def validate_output_guardrails(state: dict) -> list[str]:
    errors: list[str] = []

    score = state.get("ats_score")
    try:
        if score is None:
            raise ValueError("missing")
        score = float(score)
        if score < 0 or score > 100:
            errors.append("output_guardrail_failed: ats_score_out_of_range")
    except Exception:
        errors.append("output_guardrail_failed: ats_score_invalid")

    required_fields = [
        "main_summary",
        "skills_matched",
        "skills_not_matched",
        "pros",
        "cons",
    ]
    for field in required_fields:
        if field not in state:
            errors.append(f"output_guardrail_failed: missing_field_{field}")

    if not isinstance(state.get("main_summary"), str) or not state.get("main_summary", "").strip():
        errors.append("output_guardrail_failed: invalid_main_summary")
    if not _is_list_of_strings(state.get("skills_matched", [])):
        errors.append("output_guardrail_failed: skills_matched_invalid")
    if not _is_list_of_strings(state.get("skills_not_matched", [])):
        errors.append("output_guardrail_failed: skills_not_matched_invalid")
    if not _is_list_of_strings(state.get("pros", [])):
        errors.append("output_guardrail_failed: pros_invalid")
    if not _is_list_of_strings(state.get("cons", [])):
        errors.append("output_guardrail_failed: cons_invalid")
    return errors


def validate_safety_guardrails(state: dict) -> list[str]:
    issues: list[str] = []
    text_blob = " ".join(
        [
            str(state.get("main_summary") or ""),
            " ".join(state.get("pros", []) or []),
            " ".join(state.get("cons", []) or []),
            str(state.get("linkedin_summary") or ""),
        ]
    ).lower()

    for marker in _TOXIC_MARKERS:
        if marker in text_blob:
            issues.append(f"safety_guardrail_failed: toxic_content:{marker}")
            break

    for marker in _BIAS_MARKERS:
        if marker in text_blob:
            issues.append(f"safety_guardrail_failed: potential_bias:{marker}")
            break

    for pattern in _SENSITIVE_PATTERNS:
        if pattern.search(text_blob):
            issues.append("safety_guardrail_failed: sensitive_info_leakage")
            break

    # Email in ATS text is common (candidate contact); warn only, do not hard-fail.
    if _EMAIL_PATTERN.search(text_blob):
        issues.append("safety_guardrail_warning: email_like_in_text")

    return issues
