"""Fit Validator: validation logic for Fit Analysis Agent output."""
from typing import Any, Dict, List

from app.agents.state import ATSState
from app.core.logging import logger


def _validate_range(value: Any, field_name: str, min_val: int = 0, max_val: int = 100) -> List[str]:
    """Validate that a value is an integer within a numeric range."""
    errors = []
    
    if value is None:
        errors.append(f"fit_validation: {field_name} is missing")
        return errors
    
    try:
        num_val = int(float(value))
        if num_val < min_val or num_val > max_val:
            errors.append(f"fit_validation: {field_name}={num_val} out of range [{min_val}, {max_val}]")
        if float(value) != num_val:
            errors.append(f"fit_validation: {field_name}={value} is not an integer")
    except (TypeError, ValueError):
        errors.append(f"fit_validation: {field_name} is not a valid number: {value}")
    
    return errors


def _validate_reasoning(reasoning: Dict[str, str]) -> List[str]:
    """Validate that reasoning exists and is non-empty for all 3 metrics."""
    errors = []
    
    if not reasoning:
        errors.append("fit_validation: reasoning object is missing or empty")
        return errors
    
    required_fields = ["technical", "workplace", "advancement"]
    
    for field in required_fields:
        if field not in reasoning:
            errors.append(f"fit_validation: reasoning.{field} is missing")
        elif not reasoning[field] or not isinstance(reasoning[field], str):
            errors.append(f"fit_validation: reasoning.{field} is empty or not a string")
        elif len(reasoning[field].strip()) < 10:
            errors.append(f"fit_validation: reasoning.{field} is too short (< 10 chars)")
    
    return errors


def _cross_check_with_kpi(state: ATSState, fit_scores: Dict[str, int]) -> List[str]:
    """Cross-check fit scores against KPI metrics for logical consistency."""
    errors = []
    
    evaluation_breakdown = state.get("evaluation_breakdown", {})
    if not evaluation_breakdown:
        # Can't cross-check without KPI data
        return errors
    
    # Get KPI scores
    tech_stack_score = evaluation_breakdown.get("technology_stack", {}).get("score", 0)
    experience_score = evaluation_breakdown.get("experience", {}).get("score", 0)
    core_strengths_score = evaluation_breakdown.get("core_strengths", {}).get("score", 0)
    
    technical_suitability = fit_scores.get("technical_suitability", 0)
    workplace_alignment = fit_scores.get("workplace_alignment", 0)
    advancement_readiness = fit_scores.get("advancement_readiness", 0)
    
    # Rule 1: If tech_stack < 30, technical_suitability cannot be > 70
    if tech_stack_score < 30 and technical_suitability > 70:
        errors.append(
            f"fit_validation: technical_suitability ({technical_suitability}) too high "
            f"given tech_stack_score ({tech_stack_score}) < 30"
        )
    
    # Rule 2: If experience_score < 40, advancement_readiness cannot be > 70
    if experience_score < 40 and advancement_readiness > 70:
        errors.append(
            f"fit_validation: advancement_readiness ({advancement_readiness}) too high "
            f"given experience_score ({experience_score}) < 40"
        )
    
    # Rule 3: If core_strengths < 30, workplace_alignment cannot be > 60
    if core_strengths_score < 30 and workplace_alignment > 60:
        errors.append(
            f"fit_validation: workplace_alignment ({workplace_alignment}) too high "
            f"given core_strengths_score ({core_strengths_score}) < 30"
        )
    
    # Rule 4: Technical suitability should generally align with tech stack
    # Allow 40-point difference maximum
    if abs(technical_suitability - tech_stack_score) > 40:
        errors.append(
            f"fit_validation: technical_suitability ({technical_suitability}) diverges "
            f"significantly from tech_stack_score ({tech_stack_score})"
        )
    
    # Rule 5: All fit scores should be within reasonable range of each other
    # (unless there's a specific reason for divergence)
    fit_values = [technical_suitability, workplace_alignment, advancement_readiness]
    max_diff = max(fit_values) - min(fit_values)
    if max_diff > 60:
        errors.append(
            f"fit_validation: large variance in fit scores "
            f"(max-min = {max_diff}). Scores: {fit_values}"
        )
    
    return errors


def _validate_strengths_gaps(strengths: List[str], gaps: List[str]) -> List[str]:
    """Validate strengths and gaps lists."""
    errors = []
    
    if not isinstance(strengths, list):
        errors.append("fit_validation: strengths must be a list")
    else:
        if len(strengths) == 0:
            errors.append("fit_validation: strengths list is empty")
        for i, s in enumerate(strengths):
            if not isinstance(s, str) or not s.strip():
                errors.append(f"fit_validation: strengths[{i}] is empty or not a string")
    
    if not isinstance(gaps, list):
        errors.append("fit_validation: gaps must be a list")
    else:
        if len(gaps) == 0:
            errors.append("fit_validation: gaps list is empty")
        for i, g in enumerate(gaps):
            if not isinstance(g, str) or not g.strip():
                errors.append(f"fit_validation: gaps[{i}] is empty or not a string")
    
    # Check for overlap (same item in both lists)
    if isinstance(strengths, list) and isinstance(gaps, list):
        strength_lower = [s.lower().strip() for s in strengths if isinstance(s, str)]
        gap_lower = [g.lower().strip() for g in gaps if isinstance(g, str)]
        
        overlap = set(strength_lower) & set(gap_lower)
        if overlap:
            errors.append(
                f"fit_validation: same items appear in both strengths and gaps: {list(overlap)}"
            )
    
    return errors


def fit_validator(state: ATSState) -> ATSState:
    """
    Fit Validator Node - Validates Fit Analysis Agent output.
    
    Performs:
    1. Range checks (0-100, integers only)
    2. Cross-check with KPI metrics
    3. Reasoning validation (must exist for all 3 metrics)
    4. Strengths/gaps validation
    
    Returns validation results and any errors found.
    """
    logger.info("fit_validator_start", candidate_id=state["candidate_id"])
    
    errors = []
    validation_results = {
        "valid": True,
        "range_checks": {},
        "cross_check_issues": [],
        "reasoning_valid": False,
        "strengths_gaps_valid": False,
    }
    
    compatibility_assessment = state.get("compatibility_assessment", {})
    fit_reasoning = state.get("fit_reasoning", {})
    strengths = state.get("strengths", [])
    gaps = state.get("gaps", [])
    
    if not compatibility_assessment:
        errors.append("fit_validation: compatibility_assessment is missing")
        validation_results["valid"] = False
        return {
            "errors": [*state.get("errors", []), *errors],
            "fit_validation": validation_results,
        }
    
    # --- Range Checks ---
    range_errors = []
    
    technical = compatibility_assessment.get("technical_suitability")
    workplace = compatibility_assessment.get("workplace_alignment")
    advancement = compatibility_assessment.get("advancement_readiness")
    
    range_errors.extend(_validate_range(technical, "technical_suitability"))
    range_errors.extend(_validate_range(workplace, "workplace_alignment"))
    range_errors.extend(_validate_range(advancement, "advancement_readiness"))
    
    validation_results["range_checks"] = {
        "technical_suitability": len([e for e in range_errors if "technical_suitability" in e]) == 0,
        "workplace_alignment": len([e for e in range_errors if "workplace_alignment" in e]) == 0,
        "advancement_readiness": len([e for e in range_errors if "advancement_readiness" in e]) == 0,
    }
    errors.extend(range_errors)
    
    # --- Cross-check with KPI ---
    if technical is not None and workplace is not None and advancement is not None:
        fit_scores = {
            "technical_suitability": int(float(technical)),
            "workplace_alignment": int(float(workplace)),
            "advancement_readiness": int(float(advancement)),
        }
        cross_check_errors = _cross_check_with_kpi(state, fit_scores)
        validation_results["cross_check_issues"] = cross_check_errors
        errors.extend(cross_check_errors)
    
    # --- Reasoning Validation ---
    reasoning_errors = _validate_reasoning(fit_reasoning)
    validation_results["reasoning_valid"] = len(reasoning_errors) == 0
    errors.extend(reasoning_errors)
    
    # --- Strengths/Gaps Validation ---
    sg_errors = _validate_strengths_gaps(strengths, gaps)
    validation_results["strengths_gaps_valid"] = len(sg_errors) == 0
    errors.extend(sg_errors)
    
    # --- Final Validation Status ---
    validation_results["valid"] = len(errors) == 0
    
    # Merge with existing errors
    all_errors = list(state.get("errors", []))
    all_errors.extend(errors)
    
    logger.info(
        "fit_validator_complete",
        candidate_id=state["candidate_id"],
        valid=validation_results["valid"],
        error_count=len(errors),
    )
    
    return {
        "errors": all_errors,
        "fit_validation": validation_results,
    }
