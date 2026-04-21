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
from app.agents.guardrails import validate_process_guardrails, validate_input_guardrails, validate_parser_output
from app.core.config import settings
from app.core.logging import logger
from app.services.pdf_parser import extract_text_from_pdf
from app.services.embedding_service import embed_document


# Deterministic skill keywords for fallback extraction
TECH_SKILL_KEYWORDS = {
    # Languages
    "python", "java", "javascript", "typescript", "go", "golang", "rust", "c++", "c#",
    "ruby", "scala", "kotlin", "swift", "r", "matlab", "php", "shell", "bash",
    # Web technologies
    "html", "css", "react", "angular", "vue", "svelte", "next.js", "nuxt",
    "fastapi", "flask", "django", "spring boot", "express", "node.js", "nodejs",
    # Databases
    "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
    "dynamodb", "snowflake", "bigquery", "sqlite", "oracle", "mssql",
    # Cloud platforms
    "aws", "azure", "gcp", "google cloud", "cloud", "kubernetes", "k8s", "docker",
    "terraform", "ansible", "jenkins", "ci/cd", "devops",
    # Data & ML
    "machine learning", "deep learning", "nlp", "computer vision", "pytorch",
    "tensorflow", "scikit-learn", "pandas", "numpy", "spark", "hadoop",
    # Networking
    "tcp/ip", "http", "https", "dns", "dhcp", "bgp", "ospf", "vpn", "firewall",
    "load balancer", "network security", "routing", "switching",
    # Certifications
    "ccna", "ccnp", "aws certified", "azure certified", "pmp", "cissp", "comptia",
    # Methodologies
    "agile", "scrum", "kanban", "ci/cd", "gitops", "mlops", "dataops",
    # Tools
    "git", "github", "gitlab", "jira", "confluence", "slack", "linux", "unix",
}

SOFT_SKILL_KEYWORDS = {
    "leadership", "communication", "teamwork", "collaboration", "problem solving",
    "analytical", "critical thinking", "adaptability", "flexibility", "time management",
    "project management", "stakeholder management", "mentoring", "coaching",
}


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
        if p and len(p.split()) > 8:
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
        "node.js": "Node.js",
        "nodejs": "Node.js",
        "c++": "C++",
        "c#": "C#",
    }

    normalized: list[str] = []
    seen = set()
    for raw in skills or []:
        for frag in _split_skill_fragments(str(raw)):
            key = frag.strip().lower()
            key = alias_map.get(key, key)
            # Capitalize standard tech names
            if key in {"aws", "gcp", "azure", "sql", "api", "apis", "llms", "rag"}:
                final = key.upper()
            elif key in {"node.js", "c++", "c#"}:
                final = key
            else:
                final = frag.strip()

            dedupe_key = final.lower()
            if dedupe_key and dedupe_key not in seen:
                seen.add(dedupe_key)
                normalized.append(final)
    return normalized


def _extract_skills_deterministic(text: str) -> list[str]:
    """
    Extract skills from text using deterministic keyword matching.
    Used as fallback when LLM parsing fails or returns insufficient skills.
    """
    if not text:
        return []

    text_lower = text.lower()
    found_skills = []

    # Sort keywords by length (longest first) to match multi-word skills first
    all_keywords = sorted(TECH_SKILL_KEYWORDS | SOFT_SKILL_KEYWORDS, key=len, reverse=True)

    for keyword in all_keywords:
        # Use word boundary matching for short keywords to avoid false positives
        if len(keyword.split()) == 1:
            pattern = rf'\b{re.escape(keyword)}\b'
        else:
            pattern = re.escape(keyword)

        if re.search(pattern, text_lower, re.IGNORECASE):
            # Normalize the found skill
            if keyword in {"aws", "gcp", "sql", "api", "apis", "llm", "rag"}:
                normalized = keyword.upper()
            elif keyword in {"tcp/ip", "http", "https", "ci/cd"}:
                normalized = keyword.upper()
            else:
                normalized = keyword.title()
            found_skills.append(normalized)

    return found_skills


def _extract_experience_deterministic(text: str) -> list[dict]:
    """
    Extract work experience from text using pattern matching.
    Fallback when LLM extraction fails.
    """
    if not text:
        return []

    experience = []

    # Pattern for job entries: Title at Company, Date range
    # Matches: "Senior Engineer at Google (2020-2023)" or "Software Developer, Microsoft, 2019-2022"
    patterns = [
        r'(?P<title>[A-Za-z\s]+)\s+(?:at|,)\s+(?P<company>[A-Za-z\s,]+)[,\s]+(?P<duration>\d{4}\s*[-–]\s*(?:\d{4}|Present|present))',
        r'(?P<duration>\d{4}\s*[-–]\s*(?:\d{4}|Present|present))\s*[|:]\s*(?P<title>[A-Za-z\s]+)\s+(?:at|,)\s*(?P<company>[A-Za-z\s,]+)',
    ]

    for pattern in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            try:
                title = match.group("title").strip()
                company = match.group("company").strip()
                duration = match.group("duration").strip()

                # Clean up common artifacts
                title = re.sub(r'\s+', ' ', title)
                company = re.sub(r'\s+', ' ', company)

                # Skip if title looks like a section header
                if title.lower() in ['experience', 'work experience', 'employment', 'history', 'professional experience']:
                    continue

                # Skip if too short (likely noise)
                if len(title) < 3 or len(company) < 2:
                    continue

                experience.append({
                    "title": title,
                    "company": company,
                    "duration": duration,
                    "description": "",
                })
            except Exception:
                continue

    # Deduplicate by company+title
    seen = set()
    unique_exp = []
    for exp in experience:
        key = f"{exp['title'].lower()}::{exp['company'].lower()}"
        if key not in seen:
            seen.add(key)
            unique_exp.append(exp)

    return unique_exp[:10]  # Limit to top 10 entries


def _extract_education_deterministic(text: str) -> list[dict]:
    """
    Extract education from text using pattern matching.
    Fallback when LLM extraction fails.
    """
    if not text:
        return []

    education = []

    # Education keywords
    degree_keywords = [
        "bachelor", "master", "phd", "doctorate", "mba", "bs", "ba", "ms", "ma",
        "b.tech", "b.e.", "m.tech", "m.e.", "b.sc", "m.sc", "b.com", "m.com",
        "associate", "diploma", "certificate", "degree",
    ]

    lines = text.split('\n')
    current_edu = {}

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check if line contains degree keywords
        line_lower = line.lower()
        has_degree = any(kw in line_lower for kw in degree_keywords)

        if has_degree:
            # Try to extract year
            year_match = re.search(r'\b(19\d{2}|20\d{2})\b', line)
            year = year_match.group(1) if year_match else ""

            # Try to extract institution (look for "University", "College", "Institute")
            inst_match = re.search(r'((?:[A-Z][a-z]+\s+)*(?:University|College|Institute|Tech|IIT|NIT|IIIT))', line)
            institution = inst_match.group(1) if inst_match else ""

            # Extract degree name
            degree = line
            if institution:
                degree = line.replace(institution, "").strip()
            if year:
                degree = degree.replace(year, "").strip()

            degree = re.sub(r'\s+', ' ', degree).strip()

            if degree and len(degree) > 5:  # Skip very short entries
                education.append({
                    "degree": degree,
                    "institution": institution,
                    "year": year,
                })

    # Deduplicate
    seen = set()
    unique_edu = []
    for edu in education:
        key = f"{edu['degree'].lower()}::{edu['institution'].lower()}"
        if key not in seen:
            seen.add(key)
            unique_edu.append(edu)

    return unique_edu[:5]  # Limit to top 5 entries


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
    # LinkedIn parsing is intentionally deferred to `linkedin_agent` so it can
    # run in parallel with scorer and avoid extending parser critical path.
    linkedin_text = state.get("linkedin_text", "") or ""

    if not jd_text:
        errors.append("Failed to extract text from JD document")
    if not resume_text:
        errors.append("Failed to extract text from resume document")
    errors.extend(
        validate_input_guardrails(
            jd_text=jd_text,
            resume_text=resume_text,
            job_title=state.get("job_title"),
            filename_hints=[state.get("jd_path", ""), state.get("resume_path", "")],
        )
    )

    # ─── Pre-compute resume embedding once ───────────────────────
    # Parser runs before the fan-out to scorer + linkedin, so both can
    # reuse `resume_embedding` without embedding a second time.
    resume_embedding = None
    if settings.SCORER_USE_EMBEDDINGS:
        try:
            if resume_text:
                resume_embedding = embed_document(resume_text)
        except Exception as e:
            errors.append(f"Resume embedding error: {e}")

    # ─── Parse resume structure ───────────────────────────────────
    resume_data = {}
    llm_parse_failed = False

    if resume_text:
        try:
            resume_data = llm_call_json(
                PARSER_SYSTEM,
                PARSER_PROMPT.format(
                    resume_text=resume_text[:4000] if settings.PIPELINE_FAST_MODE else resume_text[:6000]
                ),
            )
        except Exception as e:
            errors.append(f"Resume parse error: {e}")
            llm_parse_failed = True

    if resume_data is None:
        resume_data = {}
        llm_parse_failed = True

    # ─── Deterministic fallback for skills ────────────────────────
    # If LLM parsing failed or returned insufficient skills, use deterministic extraction
    llm_skills = resume_data.get("skills", []) or []
    if llm_parse_failed or len(llm_skills) < 3:
        logger.info(
            "parser_deterministic_fallback",
            candidate_id=state.get("candidate_id"),
            reason="llm_failed" if llm_parse_failed else "insufficient_skills",
            llm_skill_count=len(llm_skills),
        )
        det_skills = _extract_skills_deterministic(resume_text)
        # Merge LLM skills with deterministic (deterministic fills gaps)
        if det_skills:
            all_skills = list(llm_skills) + [s for s in det_skills if s.lower() not in [ls.lower() for ls in llm_skills]]
            resume_data["skills"] = all_skills

    # ─── Deterministic fallback for experience ────────────────────
    # If LLM didn't extract experience, try to extract from text patterns
    llm_experience = resume_data.get("experience", []) or []
    if llm_parse_failed or len(llm_experience) == 0:
        logger.info(
            "parser_experience_fallback",
            candidate_id=state.get("candidate_id"),
            reason="llm_failed" if llm_parse_failed else "no_experience_extracted",
        )
        det_experience = _extract_experience_deterministic(resume_text)
        if det_experience and not llm_experience:
            resume_data["experience"] = det_experience

    # ─── Deterministic fallback for education ─────────────────────
    # If LLM didn't extract education, try to extract from text patterns
    llm_education = resume_data.get("education", []) or []
    if llm_parse_failed or len(llm_education) == 0:
        logger.info(
            "parser_education_fallback",
            candidate_id=state.get("candidate_id"),
            reason="llm_failed" if llm_parse_failed else "no_education_extracted",
        )
        det_education = _extract_education_deterministic(resume_text)
        if det_education and not llm_education:
            resume_data["education"] = det_education

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

    new_state = {
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
        "resume_education": resume_data.get("education", []) if isinstance(resume_data.get("education", []), list) else [],
        "jd_required_skills": jd_required_from_state or normalize_skills(jd_data.get("required_skills", [])),
        "jd_preferred_skills": jd_preferred_from_state or normalize_skills(jd_data.get("preferred_skills", [])),
        "resume_embedding": resume_embedding,
        "extracted_data": {**resume_data, "jd": jd_data},
        "errors": errors,
    }
    # Add parser-specific validation
    new_state["errors"] = [*new_state["errors"], *validate_parser_output(new_state)]
    new_state["errors"] = [*new_state["errors"], *validate_process_guardrails(new_state)]
    return new_state
