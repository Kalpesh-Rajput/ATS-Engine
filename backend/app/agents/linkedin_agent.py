"""LinkedIn consistency agent: compares resume vs LinkedIn profile."""
from app.agents.state import ATSState
from app.core.logging import logger
from app.services.embedding_service import cosine_similarity, embed_document


def linkedin_agent(state: ATSState) -> ATSState:
    """
    Node 2b — LinkedIn Agent (runs in parallel with Scorer agent)
    Checks profile consistency and issues a green/red flag.
    """
    logger.info("linkedin_agent_start", candidate_id=state["candidate_id"])

    resume_text = state.get("resume_text", "")
    linkedin_text = state.get("linkedin_text", "")

    if not linkedin_text:
        return {
            "linkedin_match_score": None,
            "linkedin_summary": "No LinkedIn profile provided.",
            "linkedin_flag": "green",
            "linkedin_embedding": None,
        }

    try:
        resume_emb = state.get("resume_embedding")
        if not resume_emb:
            resume_emb = embed_document(resume_text) if resume_text else None
        linkedin_emb = embed_document(linkedin_text)

        # Fast embedding-based consistency score.
        if resume_emb:
            score = round(max(0.0, min(100.0, cosine_similarity(resume_emb, linkedin_emb) * 100)), 1)
        else:
            score = 70.0
        flag = "green" if score >= 70 else "red"

        # Deterministic short narrative (fast, no LLM).
        # This is written to match the UI style you showed earlier.
        linkedin_lower = linkedin_text.lower()
        resume_lower = resume_text.lower()

        def _extract_years(s: str) -> list[str]:
            import re

            return re.findall(r"\b(19\d{2}|20\d{2})\b", s or "")

        def _guess_focus(t: str) -> str:
            t = (t or "").lower()
            groups = {
                "AI/ML & LLM (NLP)": ["ai", "ml", "machine learning", "nlp", "llm", "rag", "transformer"],
                "Data engineering": ["data engineering", "etl", "airflow", "spark", "kafka", "dbt"],
                "Cloud infrastructure": ["aws", "gcp", "azure", "kubernetes", "terraform", "docker"],
            }
            best_name = "software engineering"
            best_count = 0
            for name, keywords in groups.items():
                cnt = sum(1 for kw in keywords if kw in t)
                if cnt > best_count:
                    best_count = cnt
                    best_name = name
            return best_name

        # Use parser outputs when available to produce more meaningful notes.
        resume_skills = state.get("resume_skills") or []
        resume_experience = state.get("resume_experience") or []
        resume_education = state.get("resume_education") or []

        # Skills overlap
        skill_hits = 0
        skill_total = 0
        for s in resume_skills:
            st = (s or "").strip()
            if not st:
                continue
            skill_total += 1
            if st.lower() in linkedin_lower:
                skill_hits += 1
        skill_overlap_ratio = (skill_hits / skill_total) if skill_total else 1.0

        # Experience mismatches (company/title presence in LinkedIn text)
        missing_companies = []
        missing_titles = []
        for exp in resume_experience:
            company = (exp.get("company") or "").strip()
            title = (exp.get("title") or "").strip()
            if company and company.lower() not in linkedin_lower:
                missing_companies.append(company)
            if title and title.lower() not in linkedin_lower:
                missing_titles.append(title)
        missing_companies = missing_companies[:2]
        missing_titles = missing_titles[:2]

        # Date/years mismatches (simple year presence check)
        resume_years = set()
        for exp in resume_experience:
            duration = exp.get("duration") or ""
            for y in _extract_years(duration):
                resume_years.add(y)
        date_discrepancy = False
        if resume_years:
            linkedin_years_found = set(_extract_years(linkedin_text))
            # If most resume years are missing in LinkedIn, treat as discrepancy.
            if len([y for y in resume_years if y not in linkedin_years_found]) >= max(1, len(resume_years) // 2):
                date_discrepancy = True

        # Education presence
        missing_edu = []
        for edu in resume_education:
            institution = (edu.get("institution") or "").strip()
            if institution and institution.lower() not in linkedin_lower:
                missing_edu.append(institution)
        missing_edu = missing_edu[:2]

        resume_focus = _guess_focus(resume_text)
        linkedin_focus = _guess_focus(linkedin_text)

        inconsistencies: list[str] = []
        # For high scores we should not be overly strict; keep the narrative
        # aligned with how your earlier LLM summary looked.
        if skill_overlap_ratio < 0.5 and score < 80:
            inconsistencies.append("skills")
        if (missing_titles or missing_companies) and score < 85:
            inconsistencies.append("job titles")
        if date_discrepancy and score < 80:
            inconsistencies.append("employment dates")
        if missing_edu and score < 80:
            inconsistencies.append("education details")

        def _join_categories(items: list[str]) -> str:
            # Map to user-friendly phrases
            mapping = {
                "skills": "skills",
                "job titles": "job titles",
                "employment dates": "employment dates",
                "education details": "education details",
            }
            items = [mapping.get(i, i) for i in items]
            items = [i for i in items if i]
            if not items:
                return "job titles, skills, and education details"
            if len(items) == 1:
                return items[0]
            if len(items) == 2:
                return f"{items[0]} and {items[1]}"
            return f"{', '.join(items[:-1])}, and {items[-1]}"

        if score >= 80:
            categories = _join_categories(inconsistencies)
            summary = (
                "The LinkedIn profile is mostly consistent with the resume, but there are some minor discrepancies in "
                f"{categories}. Overall, the profile appears to be genuine, but some details may require verification."
            )
        elif score >= 70:
            categories = _join_categories(inconsistencies)
            summary = (
                "The LinkedIn profile matches the resume in most areas, but there are some discrepancies in "
                f"{categories}. A quick verification of these details is recommended."
            )
        else:
            categories = _join_categories(inconsistencies)
            summary = (
                "The LinkedIn profile shows notable inconsistencies with the resume in "
                f"{categories}. These areas may require manual review."
            )

        return {
            "linkedin_match_score": score,
            "linkedin_summary": summary,
            "linkedin_flag": flag,
            "linkedin_embedding": linkedin_emb,
        }

    except Exception:
        return {
            "linkedin_match_score": None,
            "linkedin_summary": "Could not analyse LinkedIn profile with embedding check.",
            "linkedin_flag": "green",
            "linkedin_embedding": None,
        }
