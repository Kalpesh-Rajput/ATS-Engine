"""KPI Validator: deterministic validation of KPI evaluation output."""
from typing import Any, Dict, List

from app.agents.state import ATSState
from app.core.logging import logger


def _validate_range(value: Any, field_name: str, min_val: float = 0, max_val: float = 100) -> List[str]:
    """Validate that a value is within a numeric range."""
    errors = []
    
    if value is None:
        errors.append(f"kpi_validation: {field_name} is missing")
        return errors
    
    try:
        num_val = float(value)
        if num_val < min_val or num_val > max_val:
            errors.append(f"kpi_validation: {field_name}={num_val} out of range [{min_val}, {max_val}]")
    except (TypeError, ValueError):
        errors.append(f"kpi_validation: {field_name} is not a valid number: {value}")
    
    return errors


def _validate_required_fields(data: Dict[str, Any], required_fields: List[str], prefix: str = "") -> List[str]:
    """Validate that required fields are present and non-empty."""
    errors = []
    for field in required_fields:
        full_path = f"{prefix}.{field}" if prefix else field
        if field not in data or data[field] is None:
            errors.append(f"kpi_validation: {full_path} is missing")
        elif isinstance(data[field], list) and len(data[field]) == 0:
            # Empty list might be acceptable for some fields
            pass
        elif isinstance(data[field], dict) and len(data[field]) == 0:
            errors.append(f"kpi_validation: {full_path} is empty")
    return errors


def _validate_logical_sanity(evaluation_breakdown: Dict[str, Any]) -> List[str]:
    """Validate logical relationships between KPI metrics."""
    errors = []
    
    tech_stack = evaluation_breakdown.get("technology_stack", {})
    experience = evaluation_breakdown.get("experience", {})
    education = evaluation_breakdown.get("education", {})
    core_strengths = evaluation_breakdown.get("core_strengths", {})
    
    # Check score vs skill counts consistency for tech stack
    tech_score = tech_stack.get("score", 0)
    skills_matched = tech_stack.get("skills_matched_count", 0)
    total_skills = tech_stack.get("total_jd_skills", 0)
    
    if total_skills > 0:
        expected_score = round((skills_matched / total_skills) * 100, 1)
        # Allow 5% tolerance due to fuzzy matching
        if abs(tech_score - expected_score) > 5:
            errors.append(
                f"kpi_validation: tech_stack score ({tech_score}) inconsistent with "
                f"skills_matched/total ({skills_matched}/{total_skills} = {expected_score}%)"
            )
    
    # Check core strengths consistency
    core_score = core_strengths.get("score", 0)
    matched_count = core_strengths.get("matched_count", 0)
    total_categories = core_strengths.get("total_categories", 6)
    
    if total_categories > 0:
        expected_core_score = round((matched_count / total_categories) * 100, 1)
        if core_score != expected_core_score:
            errors.append(
                f"kpi_validation: core_strengths score ({core_score}) inconsistent with "
                f"matched_count/total ({matched_count}/{total_categories} = {expected_core_score}%)"
            )
    
    # Check that categories_detected length matches matched_count
    categories_detected = core_strengths.get("categories_detected", [])
    if len(categories_detected) != matched_count:
        errors.append(
            f"kpi_validation: categories_detected length ({len(categories_detected)}) "
            f"does not match matched_count ({matched_count})"
        )
    
    # Check education score vs entry count (with quality factors, score can vary)
    edu_score = education.get("score", 0)
    entry_count = education.get("entry_count", 0)

    # With quality factors, score range is wider - just check it's within bounds
    if entry_count == 0 and edu_score != 0:
        errors.append(f"kpi_validation: education score ({edu_score}) should be 0 when entry_count is 0")
    elif entry_count > 0 and (edu_score < 30 or edu_score > 100):
        errors.append(f"kpi_validation: education score ({edu_score}) out of expected range for entry_count={entry_count}")

    # Check experience score vs role count (with duration/seniority factors, score can vary)
    exp_score = experience.get("score", 0)
    role_count = experience.get("role_count", 0)

    if role_count == 0 and exp_score != 0:
        errors.append(f"kpi_validation: experience score ({exp_score}) should be 0 when role_count is 0")
    elif role_count > 0 and (exp_score < 20 or exp_score > 100):
        errors.append(f"kpi_validation: experience score ({exp_score}) out of expected range for role_count={role_count}")
    
    return errors


def kpi_validator(state: ATSState) -> ATSState:
    """
    KPI Validator Node - Deterministic validation of KPI metrics.
    
    Performs:
    1. Range checks (0-100)
    2. Missing field detection
    3. Logical sanity checks
    
    Returns validation results and any errors found.
    """
    logger.info("kpi_validator_start", candidate_id=state["candidate_id"])
    
    errors = []
    validation_results = {
        "valid": True,
        "range_checks": {},
        "missing_fields": [],
        "logical_issues": [],
    }
    
    evaluation_breakdown = state.get("evaluation_breakdown", {})
    
    if not evaluation_breakdown:
        errors.append("kpi_validation: evaluation_breakdown is missing or empty")
        validation_results["valid"] = False
        return {
            "errors": [*state.get("errors", []), *errors],
            "kpi_validation": validation_results,
        }
    
    # Validate required top-level sections
    required_sections = ["technology_stack", "core_strengths", "education", "experience"]
    for section in required_sections:
        if section not in evaluation_breakdown:
            errors.append(f"kpi_validation: missing required section '{section}'")
            validation_results["missing_fields"].append(section)
            validation_results["valid"] = False
    
    # --- Technology Stack Validation ---
    tech_stack = evaluation_breakdown.get("technology_stack", {})
    tech_errors = []
    tech_errors.extend(_validate_range(tech_stack.get("score"), "technology_stack.score"))
    
    # Non-negative integers
    if tech_stack.get("skills_matched_count", 0) < 0:
        tech_errors.append("kpi_validation: technology_stack.skills_matched_count is negative")
    if tech_stack.get("total_jd_skills", 0) < 0:
        tech_errors.append("kpi_validation: technology_stack.total_jd_skills is negative")
    
    validation_results["range_checks"]["technology_stack"] = len(tech_errors) == 0
    errors.extend(tech_errors)
    
    # --- Core Strengths Validation ---
    core_strengths = evaluation_breakdown.get("core_strengths", {})
    core_errors = []
    core_errors.extend(_validate_range(core_strengths.get("score"), "core_strengths.score"))
    
    # Validate matched_count vs categories_detected
    categories_detected = core_strengths.get("categories_detected", [])
    matched_count = core_strengths.get("matched_count", 0)
    total_categories = core_strengths.get("total_categories", 6)
    
    if not isinstance(categories_detected, list):
        core_errors.append("kpi_validation: core_strengths.categories_detected must be a list")
    
    if matched_count < 0 or matched_count > total_categories:
        core_errors.append(
            f"kpi_validation: core_strengths.matched_count ({matched_count}) out of range [0, {total_categories}]"
        )
    
    validation_results["range_checks"]["core_strengths"] = len(core_errors) == 0
    errors.extend(core_errors)
    
    # --- Education Validation ---
    education = evaluation_breakdown.get("education", {})
    edu_errors = []
    edu_errors.extend(_validate_range(education.get("score"), "education.score"))
    
    entry_count = education.get("entry_count", 0)
    if entry_count < 0:
        edu_errors.append("kpi_validation: education.entry_count is negative")
    
    entries = education.get("entries", [])
    if not isinstance(entries, list):
        edu_errors.append("kpi_validation: education.entries must be a list")
    elif len(entries) != entry_count:
        edu_errors.append(
            f"kpi_validation: education.entry_count ({entry_count}) != len(entries) ({len(entries)})"
        )
    
    validation_results["range_checks"]["education"] = len(edu_errors) == 0
    errors.extend(edu_errors)
    
    # --- Experience Validation ---
    experience = evaluation_breakdown.get("experience", {})
    exp_errors = []
    exp_errors.extend(_validate_range(experience.get("score"), "experience.score"))
    
    role_count = experience.get("role_count", 0)
    if role_count < 0:
        exp_errors.append("kpi_validation: experience.role_count is negative")
    
    roles = experience.get("roles", [])
    if not isinstance(roles, list):
        exp_errors.append("kpi_validation: experience.roles must be a list")
    elif len(roles) != role_count:
        exp_errors.append(
            f"kpi_validation: experience.role_count ({role_count}) != len(roles) ({len(roles)})"
        )
    
    validation_results["range_checks"]["experience"] = len(exp_errors) == 0
    errors.extend(exp_errors)
    
    # --- Logical Sanity Checks ---
    logical_issues = _validate_logical_sanity(evaluation_breakdown)
    validation_results["logical_issues"] = logical_issues
    errors.extend(logical_issues)
    
    # --- Final Validation Status ---
    validation_results["valid"] = len(errors) == 0
    
    # Merge with existing errors
    all_errors = list(state.get("errors", []))
    all_errors.extend(errors)
    
    logger.info(
        "kpi_validator_complete",
        candidate_id=state["candidate_id"],
        valid=validation_results["valid"],
        error_count=len(errors),
    )
    
    return {
        "errors": all_errors,
        "kpi_validation": validation_results,
    }
