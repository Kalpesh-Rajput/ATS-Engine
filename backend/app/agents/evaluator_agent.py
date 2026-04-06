"""Evaluator agent: final quality gate (deterministic guardrails)."""
import json

from app.agents.state import ATSState
from app.agents.guardrails import (
    validate_input_guardrails,
    validate_output_guardrails,
    validate_process_guardrails,
    validate_safety_guardrails,
)
from app.core.logging import logger


def evaluator_agent(state: ATSState) -> ATSState:
    logger.info("evaluator_agent_start", candidate_id=state["candidate_id"])
    errors = list(state.get("errors", []))

    input_issues = validate_input_guardrails(
        jd_text=state.get("jd_text", ""),
        resume_text=state.get("resume_text", ""),
        job_title=state.get("job_title"),
    )
    process_issues = validate_process_guardrails(state)
    output_issues = validate_output_guardrails(state)
    safety_issues = validate_safety_guardrails(state)

    deterministic_issues = [*input_issues, *process_issues, *output_issues, *safety_issues]
    evaluator = {
        "verdict": "PASS",
        "confidence": 0.75,
        "reasons": [],
        "required_fixes": [],
        "source": "deterministic",
    }

    payload = {
        "candidate_id": state.get("candidate_id"),
        "job_title": state.get("job_title"),
        "jd_text_present": bool((state.get("jd_text") or "").strip()),
        "resume_text_present": bool((state.get("resume_text") or "").strip()),
        "ats_score": state.get("ats_score"),
        "main_summary": state.get("main_summary"),
        "pros": state.get("pros", []),
        "cons": state.get("cons", []),
        "skills_matched": state.get("skills_matched", []),
        "skills_not_matched": state.get("skills_not_matched", []),
        "linkedin_flag": state.get("linkedin_flag"),
        "guardrail_issues": deterministic_issues,
    }

    # Low-latency path: keep evaluator deterministic only.
    # We still preserve a compact payload snapshot for audit/debug.
    evaluator["payload"] = json.loads(json.dumps(payload, ensure_ascii=True))

    # Block outputs only on safety guardrail hard-fail signals.
    blocking_issues = [i for i in safety_issues if "_failed:" in i]
    if blocking_issues:
        evaluator["deterministic_warnings"] = blocking_issues

    output_blocked = bool(blocking_issues)

    extracted = dict(state.get("extracted_data") or {})
    extracted["guardrails"] = {
        "input": input_issues,
        "process": process_issues,
        "output": output_issues,
        "safety": safety_issues,
        "evaluator": evaluator,
        "output_blocked": output_blocked,
    }

    logger.info(
        "evaluator_agent_done",
        candidate_id=state["candidate_id"],
        verdict=evaluator["verdict"],
        blocked=output_blocked,
    )
    return {
        "errors": errors,
        "output_blocked": output_blocked,
        "extracted_data": extracted,
    }
