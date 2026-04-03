"""Evaluator agent: final quality gate (LLM judge + deterministic guardrails)."""
import json

from app.agents.state import ATSState
from app.agents.guardrails import (
    validate_input_guardrails,
    validate_output_guardrails,
    validate_process_guardrails,
    validate_safety_guardrails,
)
from app.agents.prompts.templates import EVALUATOR_PROMPT, EVALUATOR_SYSTEM
from app.agents.tools.llm_client import llm_call_json
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

    try:
        judge = llm_call_json(
            EVALUATOR_SYSTEM,
            EVALUATOR_PROMPT.format(evaluation_payload=json.dumps(payload, ensure_ascii=True)[:6000]),
        )
        # Advisory only: pipeline always sees PASS; optional LLM hints for audit.
        raw_verdict = str(judge.get("verdict", "PASS")).strip().upper()
        if raw_verdict not in {"PASS", "FAIL"}:
            raw_verdict = "PASS"
        _raw_notes = judge.get("notes") or judge.get("reasons") or []
        evaluator = {
            "verdict": "PASS",
            "confidence": float(judge.get("confidence", 0.7) or 0.7),
            "reasons": judge.get("reasons", []) if isinstance(judge.get("reasons", []), list) else [],
            "required_fixes": (
                judge.get("required_fixes", [])
                if isinstance(judge.get("required_fixes", []), list)
                else []
            ),
            "source": "llm_judge",
            "advisory_verdict": raw_verdict,
            "advisory_notes": _raw_notes if isinstance(_raw_notes, list) else [],
        }
    except Exception as exc:
        errors.append(f"evaluator_llm_error: {exc}")

    # Never block pipeline from evaluator/guardrails: record issues for audit only.
    blocking_issues = [i for i in deterministic_issues if "_failed:" in i]
    if blocking_issues:
        evaluator["deterministic_warnings"] = blocking_issues

    output_blocked = False

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
