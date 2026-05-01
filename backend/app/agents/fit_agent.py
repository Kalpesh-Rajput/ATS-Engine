"""Fit Analysis Agent: LLM-powered reasoning for candidate fit evaluation."""
from typing import Any, Dict, List

from app.agents.state import ATSState
from app.agents.tools.llm_client import llm_call_json_with_metrics
from app.core.config import settings
from app.core.logging import logger
from app.services.agent_checkpoint import (
    attach_agent_result,
    build_agent_result,
    deep_merge,
    load_agent_checkpoint,
    save_agent_checkpoint,
    stable_hash,
    summarize_llm_metrics,
)


FIT_REASONING_SYSTEM = """You write concise talent assessment reasoning.
Scores are already fixed by deterministic KPI logic. Do not change or recalculate scores.
Return ONLY valid JSON."""


FIT_REASONING_PROMPT = """Write evidence-based reasoning for these fixed fit scores.

FIXED SCORES:
- technical_suitability: {technical_suitability}
- workplace_alignment: {workplace_alignment}
- advancement_readiness: {advancement_readiness}

KPI METRICS:
- technology_stack_score: {key_metrics[tech_stack_score]}
- core_strengths_score: {key_metrics[core_strengths_score]}
- education_score: {key_metrics[education_score]}
- experience_score: {key_metrics[experience_score]}
- soft_skills_detected: {key_metrics[soft_skills_detected]}

SKILLS:
- matched: {skills_matched}
- missing: {skills_missing}

EXPERIENCE:
{experience_summary}

EDUCATION:
{education_summary}

Return JSON:
{{
  "reasoning": {{
    "technical": "1-2 concise sentences using concrete evidence",
    "workplace": "1-2 concise sentences using concrete evidence",
    "advancement": "1-2 concise sentences using concrete evidence"
  }},
  "strengths": ["specific strength 1", "specific strength 2"],
  "gaps": ["specific gap 1", "specific gap 2"]
}}"""


def _prepare_fit_input(state: ATSState) -> Dict[str, Any]:
    """Prepare structured input for Fit Analysis LLM."""
    
    evaluation_breakdown = state.get("evaluation_breakdown", {})
    
    # Pre-truncate text to 1500-3000 chars based on fast mode
    max_text_len = 1500 if settings.PIPELINE_FAST_MODE else 3000
    
    resume_text = state.get("resume_text", "")[:max_text_len]
    linkedin_text = state.get("linkedin_text", "")[:max_text_len]
    
    # Get skills from KPI data
    tech_stack = evaluation_breakdown.get("technology_stack", {})
    skills_matched_count = tech_stack.get("skills_matched_count", 0)
    total_jd_skills = tech_stack.get("total_jd_skills", 0)
    
    # Build skills lists
    skills_matched = state.get("skills_matched", [])
    skills_missing = state.get("skills_not_matched", [])
    
    # Experience summary
    experience = evaluation_breakdown.get("experience", {})
    role_count = experience.get("role_count", 0)
    roles = experience.get("roles", [])
    
    experience_summary_parts = []
    if role_count > 0:
        experience_summary_parts.append(f"{role_count} role(s) experience")
        for role in roles[:3]:  # Top 3 roles
            exp_str = f"- {role.get('title', 'Unknown')} at {role.get('company', 'Unknown')}"
            if role.get('duration'):
                exp_str += f" ({role.get('duration')})"
            experience_summary_parts.append(exp_str)
    else:
        experience_summary_parts.append("No structured experience data available")
    
    # Education summary
    education = evaluation_breakdown.get("education", {})
    edu_entry_count = education.get("entry_count", 0)
    edu_entries = education.get("entries", [])
    
    education_summary_parts = []
    if edu_entry_count > 0:
        education_summary_parts.append(f"{edu_entry_count} education credential(s)")
        for edu in edu_entries[:2]:  # Top 2 entries
            edu_str = f"- {edu.get('degree', 'Unknown')} from {edu.get('institution', 'Unknown')}"
            if edu.get('year'):
                edu_str += f" ({edu.get('year')})"
            education_summary_parts.append(edu_str)
    else:
        education_summary_parts.append("No structured education data available")
    
    # Core strengths summary
    core_strengths = evaluation_breakdown.get("core_strengths", {})
    categories_detected = core_strengths.get("categories_detected", [])
    core_score = core_strengths.get("score", 0)
    
    return {
        "evaluation_breakdown": {
            "technology_stack": tech_stack,
            "core_strengths": core_strengths,
            "education": education,
            "experience": experience,
        },
        "resume_text": resume_text,
        "linkedin_text": linkedin_text if linkedin_text else "No LinkedIn profile provided",
        "skills_matched": skills_matched,
        "skills_missing": skills_missing,
        "experience_summary": "\n".join(experience_summary_parts),
        "education_summary": "\n".join(education_summary_parts),
        "key_metrics": {
            "tech_stack_score": tech_stack.get("score", 0),
            "core_strengths_score": core_score,
            "education_score": education.get("score", 0),
            "experience_score": experience.get("score", 0),
            "soft_skills_detected": categories_detected,
        },
    }


def calculate_deterministic_fit_scores(metrics: Dict[str, Any]) -> Dict[str, int]:
    """Stable KPI-to-fit score mapping used before any LLM reasoning."""
    tech_score = float(metrics.get("tech_stack_score", 0) or 0)
    core_score = float(metrics.get("core_strengths_score", 0) or 0)
    edu_score = float(metrics.get("education_score", 0) or 0)
    exp_score = float(metrics.get("experience_score", 0) or 0)

    return {
        "technical_suitability": min(100, int(0.7 * tech_score + 0.2 * exp_score + 0.1 * edu_score)),
        "workplace_alignment": min(100, int(0.4 * core_score + 0.3 * exp_score + 0.2 * tech_score + 0.1 * edu_score)),
        "advancement_readiness": min(100, int(0.4 * edu_score + 0.3 * exp_score + 0.2 * core_score + 0.1 * tech_score)),
    }


def _validate_fit_reasoning_json(data: dict) -> list[str]:
    errors: list[str] = []
    reasoning = data.get("reasoning")
    if not isinstance(reasoning, dict):
        errors.append("reasoning_missing")
        return errors
    for field in ["technical", "workplace", "advancement"]:
        value = reasoning.get(field)
        if not isinstance(value, str) or len(value.strip()) < 10:
            errors.append(f"reasoning_{field}_too_short")
    for field in ["strengths", "gaps"]:
        value = data.get(field)
        if value is not None and not isinstance(value, list):
            errors.append(f"{field}_must_be_list")
    return errors


def fit_agent(state: ATSState) -> ATSState:
    """
    Fit Analysis Agent (Node) - LLM-powered with controlled output.
    
    Evaluates:
    - Technical Suitability (0-100)
    - Workplace Alignment (0-100)  
    - Advancement Readiness (0-100)
    
    Uses reasoning-based approach with strict JSON output format.
    Temperature = 0 for deterministic LLM output.
    """
    logger.info("fit_agent_start", candidate_id=state["candidate_id"])
    
    errors = list(state.get("errors", []))
    
    # Validate KPI data is available (should come from kpi_validator)
    evaluation_breakdown = state.get("evaluation_breakdown", {})
    if not evaluation_breakdown:
        logger.warning("fit_agent_no_kpi_data", candidate_id=state["candidate_id"])
        errors.append("fit_agent: evaluation_breakdown not available from KPI agent")
        out = {
            "errors": errors,
            "compatibility_assessment": {
                "technical_suitability": 0,
                "workplace_alignment": 0,
                "advancement_readiness": 0,
            },
            "fit_reasoning": {
                "technical": "KPI data not available - cannot assess technical suitability",
                "workplace": "KPI data not available - cannot assess workplace alignment",
                "advancement": "KPI data not available - cannot assess advancement readiness",
            },
            "key_signals": [],
            "strengths": [],
            "gaps": [],
        }
        agent_result = build_agent_result(
            status="failed",
            confidence=0.0,
            data={"reason": "missing_evaluation_breakdown"},
            errors=["fit_agent: evaluation_breakdown not available from KPI agent"],
            metrics={"fallback_used": True, "final_confidence": 0.0},
        )
        out["extracted_data"] = attach_agent_result(state.get("extracted_data"), "fit", agent_result)
        save_agent_checkpoint(
            candidate_id=state["candidate_id"],
            agent_name="fit",
            input_hash=stable_hash({"agent": "fit", "evaluation_breakdown": None}),
            output=out,
            agent_result=agent_result,
        )
        return out
    
    fit_input = _prepare_fit_input(state)
    deterministic_scores = calculate_deterministic_fit_scores(fit_input["key_metrics"])
    technical_suitability = deterministic_scores["technical_suitability"]
    workplace_alignment = deterministic_scores["workplace_alignment"]
    advancement_readiness = deterministic_scores["advancement_readiness"]

    input_hash = stable_hash(
        {
            "agent": "fit",
            "evaluation_breakdown": evaluation_breakdown,
            "skills_matched": fit_input.get("skills_matched", []),
            "skills_missing": fit_input.get("skills_missing", []),
            "deterministic_scores": deterministic_scores,
        }
    )
    cached = load_agent_checkpoint(state["candidate_id"], "fit", input_hash)
    if cached:
        cached["extracted_data"] = deep_merge(state.get("extracted_data"), cached.get("extracted_data"))
        cached["extracted_data"].setdefault("agent_cache_hits", {})["fit"] = True
        logger.info("fit_agent_checkpoint_hit", candidate_id=state["candidate_id"])
        return cached

    used_llm = True
    llm_metrics: list[dict] = []
    try:
        parsed = llm_call_json_with_metrics(
            FIT_REASONING_SYSTEM,
            FIT_REASONING_PROMPT.format(
                **fit_input,
                technical_suitability=technical_suitability,
                workplace_alignment=workplace_alignment,
                advancement_readiness=advancement_readiness,
            ),
            validate=_validate_fit_reasoning_json,
            repair_attempts=1,
            validation_attempts=1,
        )
        result = parsed.data
        llm_metrics.append(parsed.metrics)
        reasoning = result.get("reasoning", {})
        technical_reasoning = reasoning.get("technical", "No reasoning provided")
        workplace_reasoning = reasoning.get("workplace", "No reasoning provided")
        advancement_reasoning = reasoning.get("advancement", "No reasoning provided")
        strengths = result.get("strengths", []) or _derive_strengths_from_kpi(fit_input["key_metrics"])
        gaps = result.get("gaps", []) or _derive_gaps_from_kpi(fit_input["key_metrics"])
    except Exception as e:
        used_llm = False
        logger.error("fit_agent_llm_failed", candidate_id=state["candidate_id"], error=str(e))
        errors.append(f"fit_agent LLM error: {e}")
        metrics = fit_input["key_metrics"]
        technical_reasoning = (
            f"Score derived from KPI metrics: tech {metrics['tech_stack_score']}%, "
            f"experience {metrics['experience_score']}%, education {metrics['education_score']}%."
        )
        workplace_reasoning = (
            f"Score derived from KPI metrics: core strengths {metrics['core_strengths_score']}%, "
            f"experience {metrics['experience_score']}%, and tech alignment {metrics['tech_stack_score']}%."
        )
        advancement_reasoning = (
            f"Score derived from KPI metrics: education {metrics['education_score']}%, "
            f"experience {metrics['experience_score']}%, and core strengths {metrics['core_strengths_score']}%."
        )
        strengths = _derive_strengths_from_kpi(fit_input["key_metrics"])
        gaps = _derive_gaps_from_kpi(fit_input["key_metrics"])

    key_signals = _derive_key_signals(
        fit_input["key_metrics"],
        technical_suitability,
        workplace_alignment,
        advancement_readiness,
    )
    confidence = 0.88 if used_llm else 0.72
    metrics = summarize_llm_metrics(llm_metrics)
    metrics.update(
        {
            "fallback_used": not used_llm,
            "scores_source": "deterministic_kpi",
            "final_confidence": confidence,
        }
    )
    out = {
        "errors": errors,
        "compatibility_assessment": {
            "technical_suitability": technical_suitability,
            "workplace_alignment": workplace_alignment,
            "advancement_readiness": advancement_readiness,
        },
        "fit_reasoning": {
            "technical": technical_reasoning,
            "workplace": workplace_reasoning,
            "advancement": advancement_reasoning,
        },
        "key_signals": key_signals,
        "strengths": strengths,
        "gaps": gaps,
        "fit_analysis_debug": {
            "used_llm_for_reasoning": used_llm,
            "scores_source": "deterministic_kpi",
            "input_summary": {
                "tech_score": fit_input["key_metrics"]["tech_stack_score"],
                "core_score": fit_input["key_metrics"]["core_strengths_score"],
                "edu_score": fit_input["key_metrics"]["education_score"],
                "exp_score": fit_input["key_metrics"]["experience_score"],
            },
        },
    }
    agent_result = build_agent_result(
        status="success" if used_llm else "partial",
        confidence=confidence,
        data={
            "compatibility_assessment": out["compatibility_assessment"],
            "scores_source": "deterministic_kpi",
            "used_llm_for_reasoning": used_llm,
        },
        warnings=[] if used_llm else ["Fit reasoning fell back to deterministic text."],
        errors=[e for e in errors if e.startswith("fit_agent")],
        metrics=metrics,
    )
    out["extracted_data"] = attach_agent_result(state.get("extracted_data"), "fit", agent_result)
    save_agent_checkpoint(
        candidate_id=state["candidate_id"],
        agent_name="fit",
        input_hash=input_hash,
        output=out,
        agent_result=agent_result,
    )
    logger.info(
        "fit_agent_complete",
        candidate_id=state["candidate_id"],
        technical_suitability=technical_suitability,
        workplace_alignment=workplace_alignment,
        advancement_readiness=advancement_readiness,
        scores_source="deterministic_kpi",
    )
    return out


def _fit_agent_fallback(
    state: ATSState, 
    fit_input: Dict[str, Any], 
    errors: List[str]
) -> Dict[str, Any]:
    """Fallback scoring when LLM fails - uses KPI scores with adjustments."""
    
    metrics = fit_input["key_metrics"]
    tech_score = metrics["tech_stack_score"]
    core_score = metrics["core_strengths_score"]
    edu_score = metrics["education_score"]
    exp_score = metrics["experience_score"]
    
    # Deterministic mapping from KPI to fit scores
    # Technical suitability heavily weighted by tech stack
    technical_suitability = min(100, int(0.7 * tech_score + 0.2 * exp_score + 0.1 * edu_score))
    
    # Workplace alignment weighted by soft skills and experience
    workplace_alignment = min(100, int(0.4 * core_score + 0.3 * exp_score + 0.2 * tech_score + 0.1 * edu_score))
    
    # Advancement readiness based on education, experience growth signals
    advancement_readiness = min(100, int(0.4 * edu_score + 0.3 * exp_score + 0.2 * core_score + 0.1 * tech_score))
    
    strengths = _derive_strengths_from_kpi(metrics)
    gaps = _derive_gaps_from_kpi(metrics)
    key_signals = _derive_key_signals(
        metrics, technical_suitability, workplace_alignment, advancement_readiness
    )
    
    return {
        "errors": errors,
        "compatibility_assessment": {
            "technical_suitability": technical_suitability,
            "workplace_alignment": workplace_alignment,
            "advancement_readiness": advancement_readiness,
        },
        "fit_reasoning": {
            "technical": f"Score derived from KPI metrics (tech {tech_score}%, exp {exp_score}%, edu {edu_score}%). Fallback due to LLM error.",
            "workplace": f"Score derived from KPI metrics (core strengths {core_score}%, exp {exp_score}%). Fallback due to LLM error.",
            "advancement": f"Score derived from KPI metrics (edu {edu_score}%, exp {exp_score}%). Fallback due to LLM error.",
        },
        "key_signals": key_signals,
        "strengths": strengths,
        "gaps": gaps,
        "fit_analysis_debug": {
            "used_llm": False,
            "fallback_reason": "LLM call failed",
        },
    }


def _derive_strengths_from_kpi(metrics: Dict[str, Any]) -> List[str]:
    """Derive strengths list from KPI metrics."""
    strengths = []
    
    if metrics["tech_stack_score"] >= 70:
        strengths.append("Strong technology stack alignment")
    elif metrics["tech_stack_score"] >= 50:
        strengths.append("Moderate technology stack alignment")
    
    if metrics["core_strengths_score"] >= 70:
        strengths.append("Demonstrated soft skills across multiple dimensions")
    
    if metrics["experience_score"] >= 70:
        strengths.append("Extensive professional experience")
    elif metrics["experience_score"] >= 50:
        strengths.append("Solid professional experience")
    
    if metrics["education_score"] >= 70:
        strengths.append("Strong educational background")
    
    soft_skills = metrics.get("soft_skills_detected", [])
    if len(soft_skills) >= 4:
        strengths.append(f"Well-rounded soft skills profile ({len(soft_skills)}/6 categories)")
    
    return strengths if strengths else ["Candidate shows baseline qualifications"]


def _derive_gaps_from_kpi(metrics: Dict[str, Any]) -> List[str]:
    """Derive gaps list from KPI metrics."""
    gaps = []
    
    if metrics["tech_stack_score"] < 40:
        gaps.append("Limited technology stack match")
    elif metrics["tech_stack_score"] < 60:
        gaps.append("Some technology gaps to address")
    
    if metrics["core_strengths_score"] < 50:
        gaps.append("Soft skills could be further developed")
    
    if metrics["experience_score"] < 40:
        gaps.append("Limited professional experience")
    elif metrics["experience_score"] < 60:
        gaps.append("Experience depth may need development")
    
    if metrics["education_score"] < 40:
        gaps.append("Education credentials below typical requirements")
    
    soft_skills = metrics.get("soft_skills_detected", [])
    if len(soft_skills) < 3:
        gaps.append(f"Limited soft skills visibility ({len(soft_skills)}/6 categories)")
    
    return gaps if gaps else ["No major gaps identified from available data"]


def _derive_key_signals(
    metrics: Dict[str, Any],
    technical: int,
    workplace: int,
    advancement: int,
) -> List[str]:
    """Derive key signals for quick assessment."""
    signals = []
    
    # Tech signal
    tech_score = metrics["tech_stack_score"]
    if tech_score >= 80:
        signals.append(f"Strong tech match ({tech_score}%)")
    elif tech_score >= 50:
        signals.append(f"Moderate tech match ({tech_score}%)")
    else:
        signals.append(f"Tech gaps present ({tech_score}%)")
    
    # Fit signals
    if technical >= 80:
        signals.append("High technical suitability")
    if workplace >= 80:
        signals.append("Strong workplace alignment")
    if advancement >= 80:
        signals.append("Ready for advancement")
    
    # Balanced profile signal
    fit_scores = [technical, workplace, advancement]
    if min(fit_scores) >= 60 and max(fit_scores) - min(fit_scores) <= 15:
        signals.append("Well-balanced profile")
    
    return signals
