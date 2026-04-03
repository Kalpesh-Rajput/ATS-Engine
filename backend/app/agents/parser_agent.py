"""Parser agent: extracts text from PDFs and structured data from resume + JD."""
import re

from app.agents.state import ATSState
from app.agents.prompts.templates import (
    JD_PARSER_PROMPT,
    JD_PARSER_SYSTEM,
    PARSER_PROMPT,
    PARSER_SYSTEM,
)
from app.agents.tools.llm_client import llm_call_json
from app.core.logging import logger
from app.services.pdf_parser import extract_text_from_pdf
from app.services.embedding_service import embed_document


def _clean_skill_text(skill: str) -> str:
    s = (skill or "").strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"^[\-\*\u2022]+", "", s).strip()
    return s


def _split_skill_fragments(skill: str) -> list[str]:
    """
    Split noisy skill strings into atomic fragments.
    """
    s = _clean_skill_text(skill)
    if not s:
        return []

    # If the model returns long bullet-like text, break by common separators.
    parts = re.split(r",|/|;|\|| and ", s, flags=re.IGNORECASE)
    out = []
    for p in parts:
        p = _clean_skill_text(p)
        if not p:
            continue
        # Skip full sentence-like fragments to keep skills atomic.
        if len(p.split()) > 8:
            continue
        out.append(p)
    return out


def normalize_skills(skills: list[str]) -> list[str]:
    alias_map = {
        "aws": "AWS",
        "amazon web services": "AWS",
        "gcp": "GCP",
        "google cloud": "GCP",
        "azure": "Azure",
        "sql": "SQL",
        "api": "API",
        "apis": "APIs",
        "llm": "LLMs",
        "rag": "RAG",
    }

    normalized: list[str] = []
    seen = set()
    for raw in skills or []:
        for frag in _split_skill_fragments(str(raw)):
            key = frag.strip().lower()
            key = alias_map.get(key, key)
            final = key if key in {"AWS", "GCP", "Azure", "SQL", "API", "APIs", "LLMs", "RAG"} else frag.strip()

            dedupe_key = final.lower()
            if dedupe_key and dedupe_key not in seen:
                seen.add(dedupe_key)
                normalized.append(final)
    return normalized


def parser_agent(state: ATSState) -> ATSState:
    """
    Node 1 — Parser Agent
    Reads PDF text and extracts structured candidate + JD data.
    """
    logger.info("parser_agent_start", candidate_id=state["candidate_id"])
    errors = list(state.get("errors", []))

    # ─── Extract raw text ────────────────────────────────────────
    # JD parsing is identical for every candidate in a scoring job, so
    # `jd_text` / skills may be pre-populated upstream to avoid repeated work.
    jd_text = (state.get("jd_text") or "").strip()
    if not jd_text:
        jd_text = extract_text_from_pdf(state["jd_path"])
    resume_text = extract_text_from_pdf(state["resume_path"])
    linkedin_text = extract_text_from_pdf(state["linkedin_path"])

    if not jd_text:
        errors.append("Failed to extract text from JD PDF")
    if not resume_text:
        errors.append("Failed to extract text from resume PDF")

    # ─── Pre-compute resume embedding once ───────────────────────
    # Parser runs before the fan-out to scorer + linkedin, so both can
    # reuse `resume_embedding` without embedding a second time.
    resume_embedding = None
    try:
        if resume_text:
            resume_embedding = embed_document(resume_text)
    except Exception as e:
        errors.append(f"Resume embedding error: {e}")

    # ─── Parse resume structure ───────────────────────────────────
    resume_data = {}
    if resume_text:
        try:
            resume_data = llm_call_json(
                PARSER_SYSTEM,
                PARSER_PROMPT.format(resume_text=resume_text[:4000]),
            )
        except Exception as e:
            errors.append(f"Resume parse error: {e}")

    # ─── Parse JD structure ───────────────────────────────────────
    # If `jd_*_skills` already exist in state (pre-parsed once per job),
    # skip the LLM call here.
    jd_data = (state.get("extracted_data") or {}).get("jd") or {}
    jd_required_from_state = state.get("jd_required_skills") or []
    jd_preferred_from_state = state.get("jd_preferred_skills") or []
    if not jd_required_from_state and not jd_preferred_from_state and jd_text:
        try:
            jd_data = llm_call_json(
                JD_PARSER_SYSTEM,
                JD_PARSER_PROMPT.format(jd_text=jd_text[:3000]),
            )
        except Exception as e:
            errors.append(f"JD parse error: {e}")

    return {
        **state,
        "jd_text": jd_text,
        "resume_text": resume_text,
        "linkedin_text": linkedin_text,
        "name": resume_data.get("name"),
        "email": resume_data.get("email"),
        "phone": resume_data.get("phone"),
        "location": resume_data.get("location"),
        "resume_skills": normalize_skills(resume_data.get("skills", [])),
        "resume_experience": resume_data.get("experience", []),
        "resume_education": resume_data.get("education", []),
        "jd_required_skills": jd_required_from_state or normalize_skills(jd_data.get("required_skills", [])),
        "jd_preferred_skills": jd_preferred_from_state or normalize_skills(jd_data.get("preferred_skills", [])),
        "resume_embedding": resume_embedding,
        "extracted_data": {**resume_data, "jd": jd_data},
        "errors": errors,
    }
