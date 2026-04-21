"""
LangGraph multi-agent pipeline for ATS scoring.

Graph topology:
                    ┌→ scorer_agent ───┐
                    │                    │
  parser_agent ────┼→ linkedin_agent ─┼→ evaluator_agent → reporter_agent → END
                    │                    │
                    └→ kpi_agent ───────┘
                         ↓
                    kpi_validator
                         ↓
                    fit_agent
                         ↓
                    fit_validator
"""
from langgraph.graph import StateGraph, END

from app.agents.state import ATSState
from app.agents.parser_agent import parser_agent
from app.agents.scorer_agent import scorer_agent
from app.agents.linkedin_agent import linkedin_agent
from app.agents.kpi_agent import kpi_agent
from app.agents.kpi_validator import kpi_validator
from app.agents.fit_agent import fit_agent
from app.agents.fit_validator import fit_validator
from app.agents.evaluator_agent import evaluator_agent
from app.agents.reporter_agent import reporter_agent


def build_pipeline() -> StateGraph:
    workflow = StateGraph(ATSState)

    # Register nodes
    workflow.add_node("parser", parser_agent)
    workflow.add_node("scorer", scorer_agent)
    workflow.add_node("linkedin", linkedin_agent)
    workflow.add_node("kpi_agent", kpi_agent)
    workflow.add_node("kpi_validator", kpi_validator)
    workflow.add_node("fit_agent", fit_agent)
    workflow.add_node("fit_validator", fit_validator)
    workflow.add_node("evaluator", evaluator_agent)
    workflow.add_node("reporter", reporter_agent)

    # Entry point
    workflow.set_entry_point("parser")

    # Parallel fan-out from parser:
    # - scorer_agent (existing ATS scoring)
    # - linkedin_agent (existing LinkedIn check)
    # - kpi_agent (new KPI evaluation pipeline)
    workflow.add_edge("parser", "scorer")
    workflow.add_edge("parser", "linkedin")
    workflow.add_edge("parser", "kpi_agent")

    # KPI pipeline chain (sequential, independent of scorer/linkedin)
    workflow.add_edge("kpi_agent", "kpi_validator")
    workflow.add_edge("kpi_validator", "fit_agent")
    workflow.add_edge("fit_agent", "fit_validator")

    # All parallel paths converge at evaluator
    workflow.add_edge("scorer", "evaluator")
    workflow.add_edge("linkedin", "evaluator")
    workflow.add_edge("fit_validator", "evaluator")

    # Evaluator → Reporter → END
    workflow.add_edge("evaluator", "reporter")
    workflow.add_edge("reporter", END)

    return workflow.compile()


# Singleton compiled graph
_pipeline = build_pipeline()


def run_pipeline_sync(
    jd_path: str,
    resume_path: str,
    linkedin_path: str,
    job_title: str,
    recruiter_id: str,
    candidate_id: str,
    scoring_job_id: str,
    jd_text: str | None = None,
    jd_required_skills: list[str] | None = None,
    jd_preferred_skills: list[str] | None = None,
    jd_embedding: list[float] | None = None,
) -> dict:
    """
    Run the LangGraph pipeline synchronously (called from Celery worker).
    Returns the final state dict.
    """
    initial_state: ATSState = {
        "jd_path": jd_path,
        "resume_path": resume_path,
        "linkedin_path": linkedin_path,
        "job_title": job_title,
        "recruiter_id": recruiter_id,
        "candidate_id": candidate_id,
        "scoring_job_id": scoring_job_id,
        # All other fields start empty / None
        "jd_text": jd_text or "",
        "jd_embedding": jd_embedding,
        "resume_text": "",
        "linkedin_text": "",
        "name": None,
        "email": None,
        "phone": None,
        "location": None,
        "resume_skills": [],
        "resume_experience": [],
        "resume_education": [],
        "jd_required_skills": jd_required_skills or [],
        "jd_preferred_skills": jd_preferred_skills or [],
        "ats_score": None,
        "skills_matched": [],
        "skills_not_matched": [],
        "main_summary": None,
        "pros": [],
        "cons": [],
        "linkedin_match_score": None,
        "linkedin_summary": None,
        "linkedin_flag": None,
        "resume_embedding": None,
        "linkedin_embedding": None,
        "errors": [],
        "output_blocked": False,
        # KPI Evaluation fields
        "evaluation_breakdown": None,
        "kpi_validation": None,
        # Fit Analysis fields
        "compatibility_assessment": None,
        "fit_reasoning": None,
        "key_signals": [],
        "strengths": [],
        "gaps": [],
        "fit_validation": None,
        "fit_analysis_debug": None,
        "extracted_data": {},
    }

    final_state = _pipeline.invoke(initial_state)
    return dict(final_state)
