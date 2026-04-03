"""Reporter agent: merges all agent outputs and persists to vector DB."""
from app.agents.state import ATSState
from app.core.logging import logger
from app.services.vector_store import ensure_collection, upsert_candidate_vector


def reporter_agent(state: ATSState) -> ATSState:
    """
    Node 3 — Reporter Agent
    Consolidates all upstream outputs and stores resume embedding in Faiss.
    """
    logger.info(
        "reporter_agent_start",
        candidate_id=state["candidate_id"],
        ats_score=state.get("ats_score"),
        linkedin_flag=state.get("linkedin_flag"),
    )

    # Store embedding in Faiss for future semantic search
    resume_embedding = state.get("resume_embedding")
    if resume_embedding:
        try:
            ensure_collection()
            upsert_candidate_vector(
                candidate_id=state["candidate_id"],
                vector=resume_embedding,
                payload={
                    "recruiter_id": state["recruiter_id"],
                    "session_id": state.get("scoring_job_id"),
                    "profile_type": "resume",
                    "name": state.get("name"),
                    "job_applied": state.get("job_title"),
                    "ats_score": state.get("ats_score"),
                    "linkedin_flag": state.get("linkedin_flag"),
                },
            )
        except Exception as e:
            logger.warning("faiss_upsert_failed", error=str(e))

    linkedin_embedding = state.get("linkedin_embedding")
    if linkedin_embedding:
        try:
            ensure_collection()
            upsert_candidate_vector(
                candidate_id=state["candidate_id"],
                vector=linkedin_embedding,
                payload={
                    "recruiter_id": state["recruiter_id"],
                    "session_id": state.get("scoring_job_id"),
                    "profile_type": "linkedin",
                    "name": state.get("name"),
                    "job_applied": state.get("job_title"),
                    "ats_score": state.get("ats_score"),
                    "linkedin_flag": state.get("linkedin_flag"),
                },
            )
        except Exception as e:
            logger.warning("faiss_upsert_failed", error=str(e))

    logger.info(
        "reporter_agent_done",
        candidate_id=state["candidate_id"],
        ats_score=state.get("ats_score"),
        errors=state.get("errors", []),
    )
    return state
