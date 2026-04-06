"""Scorer agent: generates the ATS score via LLM + semantic similarity."""
from difflib import SequenceMatcher
import re

from app.agents.state import ATSState
from app.agents.prompts.templates import SCORER_PROMPT, SCORER_SYSTEM
from app.agents.guardrails import validate_output_guardrails
from app.agents.tools.llm_client import llm_call_json
from app.core.config import settings
from app.core.logging import logger
from app.services.embedding_service import cosine_similarity, embed_document


def _norm_skill(s: str) -> str:
    return (s or "").strip().lower()


def _normalize_for_match(s: str) -> str:
    s = _norm_skill(s)
    # Normalize punctuation variants: "AI-powered" ~= "AI power".
    s = re.sub(r"[-_/]", " ", s)
    s = re.sub(r"[^a-z0-9+#.\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _tokenize(s: str) -> list[str]:
    return [t for t in _normalize_for_match(s).split() if t]


def _partial_ratio(a: str, b: str) -> float:
    """Approximate fuzzy partial ratio (0-100) without extra dependency."""
    a = _normalize_for_match(a)
    b = _normalize_for_match(b)
    if not a or not b:
        return 0.0
    if len(a) > len(b):
        a, b = b, a
    window = len(a)
    best = 0.0
    for i in range(0, max(1, len(b) - window + 1)):
        score = SequenceMatcher(None, a, b[i : i + window]).ratio()
        if score > best:
            best = score
    return best * 100.0


def _skill_matches(jd_skill: str, candidate_skills: list[str], resume_text: str) -> bool:
    """
    Simple substring matcher to avoid LLM hallucinating skill matches.
    - "python" matches "python 3.11"
    - "fastapi" matches "FastAPI"
    """
    jd_raw = _normalize_for_match(jd_skill)
    if not jd_raw:
        return False

    # Expand alternative requirements: "AWS/Azure/equivalent", "(AWS, Azure, ...)".
    jd = re.sub(r"[()]", " ", jd_raw)
    alternatives = [
        p.strip()
        for p in re.split(r"/|,| or ", jd, flags=re.IGNORECASE)
        if p.strip()
    ]
    # Always include the original phrase too.
    if jd not in alternatives:
        alternatives.append(jd)

    resume_norm = f" {_normalize_for_match(resume_text)} "
    candidate_norm = [_normalize_for_match(c) for c in candidate_skills if _normalize_for_match(c)]

    for cand in candidate_norm:
        c = cand
        if not c:
            continue
        for alt in alternatives:
            alt_norm = _normalize_for_match(alt)
            if not alt_norm:
                continue
            if alt in c or c in alt:
                return True
            # Token overlap fallback for phrase-level variants.
            alt_tokens = set(_tokenize(alt_norm))
            c_tokens = set(_tokenize(c))
            if alt_tokens and c_tokens:
                overlap = len(alt_tokens & c_tokens)
                if overlap >= max(1, min(len(alt_tokens), len(c_tokens)) - 1):
                    return True

    # Final fallback: direct scan in full resume text to protect against parser misses.
    for alt in alternatives:
        alt_norm = _normalize_for_match(alt)
        if not alt_norm:
            continue
        if f" {alt_norm} " in resume_norm:
            return True
        # For short single-token skills (html/css/ui/ux), token-boundary contains check.
        if len(alt_norm.split()) == 1 and re.search(rf"\b{re.escape(alt_norm)}\b", resume_norm):
            return True
    return False


def scorer_agent(state: ATSState) -> ATSState:
    """
    Node 2a — Scorer Agent (runs in parallel with LinkedIn agent)
    Computes ATS score, matched/unmatched skills, summary, pros, cons.
    """
    logger.info("scorer_agent_start", candidate_id=state["candidate_id"])
    errors = list(state.get("errors", []))

    resume_text = state.get("resume_text", "")
    jd_text = state.get("jd_text", "")
    jd_required = state.get("jd_required_skills", []) or []
    jd_preferred = state.get("jd_preferred_skills", []) or []
    candidate_skills = state.get("resume_skills", []) or []

    if not resume_text or not jd_text:
        # In parallel mode, don't return the full state (avoids concurrent
        # writes to shared keys like jd_path).
        logger.warning("scorer_agent_skipped", candidate_id=state["candidate_id"])
        return {"ats_score": 0.0}

    # ─── Semantic similarity as a calibration signal ──────────────
    # Resume embedding is computed once in `parser_agent` (shared by
    # scorer + linkedin due to LangGraph fan-out). JD embedding should be
    # computed once per job in the Celery task and passed via state.
    resume_emb = state.get("resume_embedding")
    jd_emb = state.get("jd_embedding")

    try:
        if settings.SCORER_USE_EMBEDDINGS:
            if not resume_emb and resume_text:
                resume_emb = embed_document(resume_text)
            if not jd_emb and jd_text:
                jd_emb = embed_document(jd_text)

            if resume_emb and jd_emb:
                semantic_score = cosine_similarity(resume_emb, jd_emb) * 100
            else:
                semantic_score = 50.0
        else:
            semantic_score = 50.0
    except Exception as e:
        errors.append(f"Embedding error: {e}")
        semantic_score = 50.0  # neutral fallback

    # ─── Deterministic skill match lists (always available) ──────
    # Keep original order for stable UI.
    seen = set()
    jd_all: list[str] = []
    for s in [*jd_required, *jd_preferred]:
        ns = _norm_skill(s)
        if ns and ns not in seen:
            seen.add(ns)
            jd_all.append(s)

    skills_matched: list[str] = []
    skills_not_matched: list[str] = []
    for jd_skill in jd_all:
        if _skill_matches(jd_skill, candidate_skills, resume_text):
            skills_matched.append(jd_skill)
        else:
            skills_not_matched.append(jd_skill)

    # Deterministic skills coverage used in ATS formula
    if len(jd_all) > 0:
        skills_pct_det = round((len(skills_matched) / len(jd_all)) * 100, 1)
    else:
        skills_pct_det = 0.0

    # ─── LLM scoring ─────────────────────────────────────────────
    used_llm = True
    try:
        result = llm_call_json(
            SCORER_SYSTEM,
            SCORER_PROMPT.format(
                jd_text=jd_text[:1500] if settings.PIPELINE_FAST_MODE else jd_text[:3000],
                resume_text=resume_text[:1500] if settings.PIPELINE_FAST_MODE else resume_text[:3000],
                required_skills=jd_required,
                preferred_skills=jd_preferred,
                candidate_skills=candidate_skills,
            ),
        )

        # Derive weighted ATS score from explicit sub-scores.
        def _clamp_pct(val, default):
            try:
                v = float(val)
            except (TypeError, ValueError):
                v = default
            return max(0.0, min(100.0, v))

        # Skills weight must follow deterministic skills coverage, not LLM estimate.
        skills_pct = _clamp_pct(skills_pct_det, 0.0)
        # Round sub-scores to whole numbers to reduce run-to-run jitter from the LLM.
        exp_pct = round(_clamp_pct(result.get("experience_relevance_pct"), skills_pct))
        edu_pct = round(_clamp_pct(result.get("education_fit_pct"), skills_pct))
        prof_pct = round(_clamp_pct(result.get("profile_strength_pct"), skills_pct))

        final_score = float(
            round(0.70 * skills_pct + 0.20 * exp_pct + 0.05 * edu_pct + 0.05 * prof_pct)
        )

        # Keep these in output for auditability/debugging if needed.
        result["skills_match_pct"] = skills_pct
        result["experience_relevance_pct"] = exp_pct
        result["education_fit_pct"] = edu_pct
        result["profile_strength_pct"] = prof_pct

        result["skills_matched"] = skills_matched
        result["skills_not_matched"] = skills_not_matched

    except Exception as e:
        used_llm = False
        errors.append(f"Scorer LLM error: {e}")
        logger.warning(
            "scorer_llm_fallback_used",
            candidate_id=state.get("candidate_id"),
            error=str(e),
        )
        # Fallback: keep sections populated even if LLM is rate-limited.
        skills_pct = max(0.0, min(100.0, skills_pct_det))
        exp_pct = round(max(0.0, min(100.0, semantic_score)))
        edu_pct = 60.0
        prof_pct = 65.0
        final_score = float(
            round(0.70 * skills_pct + 0.20 * exp_pct + 0.05 * edu_pct + 0.05 * prof_pct)
        )
        result = {
            "skills_matched": skills_matched,
            "skills_not_matched": skills_not_matched,
            "main_summary": (
                "Score is based on deterministic JD-skill coverage with fallback relevance "
                "estimation due to temporary model rate limiting."
            ),
            "pros": [
                "Resume shows relevant experience for the role where described.",
                "Profile structure supports a clear read of background and impact.",
            ],
            "cons": [
                "Some job requirements are not clearly evidenced on the resume.",
                "Technical depth on key stack items may need verification in interview.",
            ],
        }

    # ─── Reliability validation (summary vs skills) ──────────────
    # If the LLM summary names a JD skill that deterministic matching marks
    # missing, rewrite only the summary so it does not contradict the Skills
    # section. Pros/cons stay as qualitative LLM output (not skill lists).
    try:
        main_summary = str(result.get("main_summary") or "")
        summary_lower = main_summary.lower()
        contradictory = []
        for s in skills_not_matched:
            if s and _partial_ratio(s, summary_lower) >= 85.0:
                contradictory.append(s)

        if contradictory:
            # Use a qualitative, HR-friendly summary that does not repeat
            # numeric percentages or ATS score, but still reflects that
            # there are some gaps against the JD.
            result["main_summary"] = (
                "Overall, the candidate shows reasonable alignment with the core job "
                "requirements based on the skills and experience evidenced in the resume. "
                "Their background appears broadly suitable for the role, although a few "
                "important requirements are not clearly demonstrated and may need to be "
                "probed further during interviews or technical assessments."
            )
            errors.append(f"summary_skill_contradiction_detected: {contradictory[:5]}")
    except Exception as e:
        # Never break scoring due to validation; just record the issue.
        errors.append(f"scorer_validation_failed: {e}")

    out = {
        "ats_score": final_score,
        "skills_matched": result.get("skills_matched", []),
        "skills_not_matched": result.get("skills_not_matched", []),
        "main_summary": result.get("main_summary", ""),
        "pros": result.get("pros", []),
        "cons": result.get("cons", []),
        "resume_embedding": resume_emb,
        "jd_embedding": jd_emb,
        "errors": errors,
        "extracted_data": {
            **(state.get("extracted_data") or {}),
            "scorer_debug": {
                "used_llm": used_llm,
                "skills_pct_det": skills_pct_det,
                "semantic_score": round(float(semantic_score), 2) if semantic_score is not None else None,
            },
        },
    }
    out["errors"] = [*(out.get("errors", []) or []), *validate_output_guardrails(out)]
    return out
