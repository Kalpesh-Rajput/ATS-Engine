# """KPI Evaluation Agent: fully deterministic scoring of candidate fit metrics."""
# import re
# from typing import Any, Dict, List, Set
# from difflib import SequenceMatcher

# from app.agents.state import ATSState
# from app.core.logging import logger


# def _normalize_for_match(s: str) -> str:
#     """Normalize text for skill matching (same as scorer_agent)."""
#     s = (s or "").strip().lower()
#     s = re.sub(r"[-_/]", " ", s)
#     s = re.sub(r"[^a-z0-9+#.\s]", " ", s)
#     s = re.sub(r"\s+", " ", s).strip()
#     return s


# def _tokenize(s: str) -> list[str]:
#     """Tokenize normalized string (same as scorer_agent)."""
#     return [t for t in _normalize_for_match(s).split() if t]


# def _partial_ratio(a: str, b: str) -> float:
#     """Approximate fuzzy partial ratio (0-100) (same as scorer_agent)."""
#     a = _normalize_for_match(a)
#     b = _normalize_for_match(b)
#     if not a or not b:
#         return 0.0
#     if len(a) > len(b):
#         a, b = b, a
#     window = len(a)
#     best = 0.0
#     for i in range(0, max(1, len(b) - window + 1)):
#         score = SequenceMatcher(None, a, b[i : i + window]).ratio()
#         if score > best:
#             best = score
#     return best * 100.0


# def _skill_matches(jd_skill: str, candidate_skills: list[str], resume_text: str) -> bool:
#     """
#     Simple substring matcher to avoid LLM hallucinating skill matches (same as scorer_agent).
#     - "python" matches "python 3.11"
#     - "fastapi" matches "FastAPI"
#     """
#     jd_raw = _normalize_for_match(jd_skill)
#     if not jd_raw:
#         return False

#     # Expand alternative requirements: "AWS/Azure/equivalent", "(AWS, Azure, ...)".
#     jd = re.sub(r"[()]", " ", jd_raw)
#     alternatives = [
#         p.strip()
#         for p in re.split(r"/|,| or ", jd, flags=re.IGNORECASE)
#         if p.strip()
#     ]
#     # Always include the original phrase too.
#     if jd not in alternatives:
#         alternatives.append(jd)

#     resume_norm = f" {_normalize_for_match(resume_text)} "
#     candidate_norm = [_normalize_for_match(c) for c in candidate_skills if _normalize_for_match(c)]

#     for cand in candidate_norm:
#         c = cand
#         if not c:
#             continue
#         for alt in alternatives:
#             alt_norm = _normalize_for_match(alt)
#             if not alt_norm:
#                 continue
#             if alt in c or c in alt:
#                 return True
#             # Token overlap fallback for phrase-level variants.
#             alt_tokens = set(_tokenize(alt_norm))
#             c_tokens = set(_tokenize(c))
#             if alt_tokens and c_tokens:
#                 overlap = len(alt_tokens & c_tokens)
#                 if overlap >= max(1, min(len(alt_tokens), len(c_tokens)) - 1):
#                     return True

#     # Final fallback: direct scan in full resume text to protect against parser misses.
#     for alt in alternatives:
#         alt_norm = _normalize_for_match(alt)
#         if not alt_norm:
#             continue
#         if f" {alt_norm} " in resume_norm:
#             return True
#         # For short single-token skills (html/css/ui/ux), token-boundary contains check.
#         if len(alt_norm.split()) == 1 and re.search(rf"\b{re.escape(alt_norm)}\b", resume_norm):
#             return True
#     return False


# # Soft skill categories for Core Strengths detection
# SOFT_SKILL_CATEGORIES = {
#     "leadership": [
#         "leadership", "leading", "lead", "managed team", "team lead", "tech lead",
#         "mentored", "mentorship", "supervised", "directed", "headed", "chaired",
#         "oversaw", "coordinated team", "driven", "driving", "spearheaded",
#         "captain", "founder", "co-founder", "principal", "architect",
#     ],
#     "collaboration": [
#         "collaboration", "collaborated", "teamwork", "cross-functional",
#         "cross functional", "stakeholder", "stakeholders", "partnered",
#         "cooperation", "cooperative", "team player", "working with",
#         "coordinated with", "aligned with", "engaged with", "interdisciplinary",
#     ],
#     "communication": [
#         "communication", "communicated", "presented", "presentation", "writing",
#         "written", "verbal", "interpersonal", "documentation", "reporting",
#         "articulate", "conveyed", "facilitated", "moderated", "public speaking",
#         "negotiation", "negotiated", "influenced", "storytelling",
#     ],
#     "problem_solving": [
#         "problem solving", "problem-solving", "analytical", "analysis",
#         "analyzed", "debugging", "debugged", "troubleshooting", "troubleshoot",
#         "root cause", "solution", "solved", "resolved", "investigated",
#         "diagnosed", "critical thinking", "logical", "reasoning", "strategic",
#         "optimization", "optimized", "improved efficiency", "reduced",
#         "increased", "enhanced", "data-driven", "data driven",
#     ],
#     "ownership": [
#         "ownership", "owned", "took ownership", "end-to-end", "end to end",
#         "full lifecycle", "full stack", "full-stack", "responsible for",
#         "accountable", "drove", "driven", "initiated", "initiative",
#         "proactive", "self-starter", "self starter", "autonomous",
#         "independently", "solo", "delivered", "shipped", "launched",
#     ],
#     "adaptability": [
#         "adaptability", "adaptable", "adapted", "flexible", "agile",
#         "pivot", "pivoted", "rapidly changing", "fast-paced", "fast paced",
#         "multi-tasking", "multitasking", "context switching", "learned quickly",
#         "quick learner", "self-learning", "self learning", "upskilled",
#         "reskilled", "new domain", "unfamiliar", "stretch assignment",
#     ],
# }


# def _normalize_text(text: str) -> str:
#     """Normalize text for matching."""
#     return (text or "").lower().strip()


# def _detect_soft_skill_category(category: str, text: str) -> bool:
#     """Check if a soft skill category is present in text."""
#     text_lower = _normalize_text(text)
#     if not text_lower:
#         return False
    
#     keywords = SOFT_SKILL_CATEGORIES.get(category, [])
#     for keyword in keywords:
#         if keyword in text_lower:
#             return True
#     return False


# def _merge_experience_roles(experience: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
#     """Merge and deduplicate experience entries by company+title."""
#     if not experience:
#         return []
    
#     seen: Set[str] = set()
#     merged = []
    
#     for exp in experience:
#         company = (exp.get("company") or "").strip().lower()
#         title = (exp.get("title") or "").strip().lower()
#         key = f"{company}::{title}"
        
#         if key and key not in seen:
#             seen.add(key)
#             merged.append(exp)
    
#     return merged


# def _merge_education_entries(education: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
#     """Merge and deduplicate education entries by institution+degree."""
#     if not education:
#         return []
    
#     seen: Set[str] = set()
#     merged = []
    
#     for edu in education:
#         institution = (edu.get("institution") or "").strip().lower()
#         degree = (edu.get("degree") or "").strip().lower()
#         key = f"{institution}::{degree}"
        
#         if key and key not in seen:
#             seen.add(key)
#             merged.append(edu)
    
#     return merged


# def _calculate_skill_match_pct(
#     resume_skills: List[str],
#     jd_required_skills: List[str],
#     jd_preferred_skills: List[str],
#     resume_text: str = "",
# ) -> float:
#     """Calculate skill match percentage (0-100) using consistent matching logic."""
#     all_jd_skills = []
#     seen = set()

#     for skill in jd_required_skills:
#         ns = _normalize_text(skill)
#         if ns and ns not in seen:
#             seen.add(ns)
#             all_jd_skills.append(skill)

#     for skill in jd_preferred_skills:
#         ns = _normalize_text(skill)
#         if ns and ns not in seen:
#             seen.add(ns)
#             all_jd_skills.append(skill)

#     if not all_jd_skills:
#         return 100.0  # No requirements = full match

#     # Use consistent _skill_matches function for matching
#     matches = 0
#     for jd_skill in all_jd_skills:
#         if _skill_matches(jd_skill, resume_skills, resume_text):
#             matches += 1

#     return round((matches / len(all_jd_skills)) * 100, 1)


# def _calculate_core_strengths_score(resume_text: str, experience: List[Dict[str, Any]]) -> dict:
#     """Calculate core strengths score based on soft skill category detection."""
#     text_to_analyze = _normalize_text(resume_text)
    
#     # Also scan experience descriptions
#     for exp in experience:
#         desc = exp.get("description") or ""
#         if desc:
#             text_to_analyze += " " + _normalize_text(desc)
    
#     categories_detected = {}
#     for category in SOFT_SKILL_CATEGORIES.keys():
#         categories_detected[category] = _detect_soft_skill_category(category, text_to_analyze)
    
#     matched_count = sum(1 for v in categories_detected.values() if v)
#     total_categories = len(SOFT_SKILL_CATEGORIES)
    
#     score = round((matched_count / total_categories) * 100, 1)
    
#     return {
#         "score": score,
#         "categories_detected": {k: v for k, v in categories_detected.items() if v},
#         "categories_missed": [k for k, v in categories_detected.items() if not v],
#         "matched_count": matched_count,
#         "total_categories": total_categories,
#     }


# def _calculate_education_score(education: List[Dict[str, Any]]) -> dict:
#     """
#     Calculate education score based on entry count, degree level, and institution quality.

#     Scoring breakdown:
#     - Base score from entry count (60% weight)
#     - Degree level bonus (25% weight) - higher degrees get more points
#     - Institution prestige bonus (15% weight) - top institutions
#     """
#     merged_edu = _merge_education_entries(education)
#     entry_count = len(merged_edu)

#     # Degree level keywords
#     degree_levels = {
#         "phd": 10.0,
#         "doctorate": 10.0,
#         "master": 7.0,
#         "mba": 7.0,
#         "ms": 7.0,
#         "ma": 7.0,
#         "m.tech": 7.0,
#         "m.e.": 7.0,
#         "bachelor": 4.0,
#         "bs": 4.0,
#         "ba": 4.0,
#         "b.tech": 4.0,
#         "b.e.": 4.0,
#         "b.sc": 3.0,
#         "b.com": 3.0,
#         "associate": 2.0,
#         "diploma": 2.0,
#     }

#     # Top institution keywords (prestige bonus)
#     top_institution_keywords = [
#         "iit", "nit", "iiit", "bits", "iim", "iisc",
#         "mit", "stanford", "harvard", "caltech", "berkeley", "carnegie mellon",
#         "oxford", "cambridge", "imperial", "eth", "epfl",
#         "university of", "institute of technology",
#     ]

#     # 1. Base score from entry count (max 60 points)
#     if entry_count == 0:
#         base_score = 0.0
#     elif entry_count == 1:
#         base_score = 30.0
#     elif entry_count == 2:
#         base_score = 50.0
#     else:
#         base_score = 60.0

#     # 2. Degree level bonus (max 25 points)
#     degree_bonus = 0.0
#     for edu in merged_edu:
#         degree = (edu.get("degree", "") or "").lower()
#         for kw, points in degree_levels.items():
#             if kw in degree:
#                 degree_bonus += points
#                 break
#     degree_bonus = min(degree_bonus, 25.0)

#     # 3. Institution prestige bonus (max 15 points)
#     institution_bonus = 0.0
#     for edu in merged_edu:
#         institution = (edu.get("institution", "") or "").lower()
#         for keyword in top_institution_keywords:
#             if keyword in institution:
#                 institution_bonus += 5.0
#                 break
#     institution_bonus = min(institution_bonus, 15.0)

#     # Total score
#     score = round(base_score + degree_bonus + institution_bonus, 1)
#     score = min(100.0, max(0.0, score))  # Clamp to 0-100

#     return {
#         "score": score,
#         "entry_count": entry_count,
#         "degree_bonus": round(degree_bonus, 1),
#         "institution_bonus": round(institution_bonus, 1),
#         "entries": merged_edu,
#     }


# def _parse_duration_years(duration_str: str) -> float:
#     """Parse duration string to years (e.g., '2020-2023' -> 3.0, '3 years' -> 3.0)."""
#     if not duration_str:
#         return 0.0

#     # Try year range pattern: 2020-2023, 2020-2024, 2020-Present
#     range_match = re.search(r'(\d{4})\s*[-–]\s*(\d{4}|Present|present)', duration_str)
#     if range_match:
#         start_year = int(range_match.group(1))
#         end_str = range_match.group(2)
#         if end_str.lower() == 'present':
#             end_year = 2026  # Current year
#         else:
#             end_year = int(end_str)
#         return max(0.5, end_year - start_year)  # Minimum 0.5 years

#     # Try "X years" pattern
#     years_match = re.search(r'(\d+(?:\.\d+)?)\s*years?', duration_str, re.IGNORECASE)
#     if years_match:
#         return float(years_match.group(1))

#     # Default: assume 1 year if duration present but unparseable
#     return 1.0


# def _calculate_experience_score(experience: List[Dict[str, Any]]) -> dict:
#     """
#     Calculate experience score based on role count, duration, and seniority signals.

#     Scoring breakdown:
#     - Base score from role count (60% weight)
#     - Duration bonus (25% weight) - total years of experience
#     - Seniority bonus (15% weight) - senior/principal/lead titles
#     """
#     merged_exp = _merge_experience_roles(experience)
#     role_count = len(merged_exp)

#     # Seniority keywords (indicate higher-level roles)
#     senior_keywords = [
#         "senior", "lead", "principal", "staff", "chief", "head", "director",
#         "vp", "vice president", "manager", "architect", "founder", "co-founder",
#     ]

#     # Calculate components
#     # 1. Base score from role count (max 60 points)
#     if role_count == 0:
#         base_score = 0.0
#     elif role_count == 1:
#         base_score = 25.0
#     elif role_count == 2:
#         base_score = 40.0
#     elif role_count == 3:
#         base_score = 50.0
#     elif role_count == 4:
#         base_score = 55.0
#     else:
#         base_score = 60.0

#     # 2. Duration bonus (max 25 points)
#     total_years = 0.0
#     for exp in merged_exp:
#         duration = exp.get("duration", "")
#         total_years += _parse_duration_years(duration)

#     # Cap at 15 years for scoring purposes
#     capped_years = min(total_years, 15.0)
#     duration_bonus = (capped_years / 15.0) * 25.0

#     # 3. Seniority bonus (max 15 points)
#     seniority_bonus = 0.0
#     for exp in merged_exp:
#         title = (exp.get("title", "") or "").lower()
#         for keyword in senior_keywords:
#             if keyword in title:
#                 seniority_bonus += 3.0
#                 break  # Only count once per role

#     seniority_bonus = min(seniority_bonus, 15.0)  # Cap at 15

#     # Total score
#     score = round(base_score + duration_bonus + seniority_bonus, 1)
#     score = min(100.0, max(0.0, score))  # Clamp to 0-100

#     return {
#         "score": score,
#         "role_count": role_count,
#         "total_years": round(total_years, 1),
#         "seniority_bonus": round(seniority_bonus, 1),
#         "roles": [
#             {
#                 "title": exp.get("title", ""),
#                 "company": exp.get("company", ""),
#                 "duration": exp.get("duration", ""),
#             }
#             for exp in merged_exp
#         ],
#     }


# def kpi_agent(state: ATSState) -> ATSState:
#     """
#     KPI Evaluation Agent (Node) - Fully Deterministic

#     Calculates 4 key metrics:
#     1. Technology Stack (skill match %)
#     2. Core Strengths (soft skills category detection)
#     3. Education (merged entries, capped at 100)
#     4. Experience (role count based, capped at 100)

#     Returns KPI metrics in evaluation_breakdown format.
#     """
#     logger.info("kpi_agent_start", candidate_id=state["candidate_id"])

#     resume_skills = state.get("resume_skills", []) or []
#     jd_required = state.get("jd_required_skills", []) or []
#     jd_preferred = state.get("jd_preferred_skills", []) or []
#     resume_text = state.get("resume_text", "") or ""
#     experience = state.get("resume_experience", []) or []
#     education = state.get("resume_education", []) or []

#     # ─── 1. Technology Stack Score (with consistent skill matching) ───
#     # Build deduplicated JD skills list
#     all_jd_skills = []
#     seen = set()
#     for skill in jd_required + jd_preferred:
#         ns = _normalize_text(skill)
#         if ns and ns not in seen:
#             seen.add(ns)
#             all_jd_skills.append(skill)

#     # Match skills using consistent logic with scorer_agent
#     skills_matched = []
#     skills_not_matched = []
#     for jd_skill in all_jd_skills:
#         if _skill_matches(jd_skill, resume_skills, resume_text):
#             skills_matched.append(jd_skill)
#         else:
#             skills_not_matched.append(jd_skill)

#     # Calculate score from matched count
#     if len(all_jd_skills) > 0:
#         tech_stack_score = round((len(skills_matched) / len(all_jd_skills)) * 100, 1)
#     else:
#         tech_stack_score = 100.0
    
#     # 2. Core Strengths Score (Soft Skills)
#     core_strengths = _calculate_core_strengths_score(resume_text, experience)
    
#     # 3. Education Score
#     education_result = _calculate_education_score(education)
    
#     # 4. Experience Score
#     experience_result = _calculate_experience_score(experience)
    
#     # Build key signals list
#     key_signals = []
    
#     # Tech match signal
#     if tech_stack_score >= 80:
#         key_signals.append(f"Strong tech match ({tech_stack_score}%)")
#     elif tech_stack_score >= 50:
#         key_signals.append(f"Moderate tech match ({tech_stack_score}%)")
#     else:
#         key_signals.append(f"Limited tech match ({tech_stack_score}%)")
    
#     # Soft skills signal
#     core_matched = core_strengths["matched_count"]
#     core_total = core_strengths["total_categories"]
#     key_signals.append(f"{core_matched}/{core_total} soft skills detected")
    
#     # Experience signal
#     role_count = experience_result["role_count"]
#     if role_count > 0:
#         key_signals.append(f"{role_count} role{'s' if role_count > 1 else ''} experience")
    
#     # Education signal
#     edu_count = education_result["entry_count"]
#     if edu_count > 0:
#         key_signals.append(f"{edu_count} education credential{'s' if edu_count > 1 else ''}")
    
#     evaluation_breakdown = {
#         "technology_stack": {
#             "score": tech_stack_score,
#             "skills_matched_count": len(skills_matched),
#             "total_jd_skills": len(all_jd_skills),
#             "skills_matched": skills_matched,
#             "skills_not_matched": skills_not_matched,
#         },
#         "core_strengths": {
#             "score": core_strengths["score"],
#             "categories_detected": list(core_strengths["categories_detected"].keys()),
#             "categories_missed": core_strengths["categories_missed"],
#             "matched_count": core_strengths["matched_count"],
#             "total_categories": core_strengths["total_categories"],
#         },
#         "education": {
#             "score": education_result["score"],
#             "entry_count": education_result["entry_count"],
#             "entries": [
#                 {
#                     "degree": e.get("degree", ""),
#                     "institution": e.get("institution", ""),
#                     "year": e.get("year", ""),
#                 }
#                 for e in education_result["entries"]
#             ],
#         },
#         "experience": {
#             "score": experience_result["score"],
#             "role_count": experience_result["role_count"],
#             "roles": experience_result["roles"],
#         },
#         "key_signals": key_signals,
#     }
    
#     logger.info(
#         "kpi_agent_complete",
#         candidate_id=state["candidate_id"],
#         tech_score=tech_stack_score,
#         core_strengths_score=core_strengths["score"],
#         education_score=education_result["score"],
#         experience_score=experience_result["score"],
#     )
    
#     return {
#         "evaluation_breakdown": evaluation_breakdown,
#     }

# New implementation


"""KPI Evaluation Agent: fully deterministic scoring of candidate fit metrics."""
import re
from typing import Any, Dict, List, Set
from difflib import SequenceMatcher

from app.agents.state import ATSState
from app.core.logging import logger


# ─────────────────────────────────────────────────────────────────────────────
# Skill Matching Helpers (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_for_match(s: str) -> str:
    """Normalize text for skill matching (same as scorer_agent)."""
    s = (s or "").strip().lower()
    s = re.sub(r"[-_/]", " ", s)
    s = re.sub(r"[^a-z0-9+#.\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _tokenize(s: str) -> list[str]:
    """Tokenize normalized string (same as scorer_agent)."""
    return [t for t in _normalize_for_match(s).split() if t]


def _partial_ratio(a: str, b: str) -> float:
    """Approximate fuzzy partial ratio (0-100) (same as scorer_agent)."""
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
    Simple substring matcher to avoid LLM hallucinating skill matches (same as scorer_agent).
    - "python" matches "python 3.11"
    - "fastapi" matches "FastAPI"
    """
    jd_raw = _normalize_for_match(jd_skill)
    if not jd_raw:
        return False

    jd = re.sub(r"[()]", " ", jd_raw)
    alternatives = [
        p.strip()
        for p in re.split(r"/|,| or ", jd, flags=re.IGNORECASE)
        if p.strip()
    ]
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
            alt_tokens = set(_tokenize(alt_norm))
            c_tokens = set(_tokenize(c))
            if alt_tokens and c_tokens:
                overlap = len(alt_tokens & c_tokens)
                if overlap >= max(1, min(len(alt_tokens), len(c_tokens)) - 1):
                    return True

    for alt in alternatives:
        alt_norm = _normalize_for_match(alt)
        if not alt_norm:
            continue
        if f" {alt_norm} " in resume_norm:
            return True
        if len(alt_norm.split()) == 1 and re.search(rf"\b{re.escape(alt_norm)}\b", resume_norm):
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Education Extraction Helpers (NEW)
# ─────────────────────────────────────────────────────────────────────────────

EDUCATION_HEADERS = [
    "education", "academic background", "academics",
    "qualification", "educational qualification",
]

DEGREE_PATTERNS = [
    r"\b(b\.?tech|bachelor of technology)\b",
    r"\b(m\.?tech|master of technology)\b",
    r"\b(b\.?e\.?|bachelor of engineering)\b",
    r"\b(m\.?e\.?|master of engineering)\b",
    r"\b(bachelor(?:'s)? (?:of )?degree)\b",
    r"\b(master(?:'s)? (?:of )?degree)\b",
    r"\bph\.?d\b",
    r"\bmba\b",
    r"\bdiploma\b",
    r"\b(b\.?sc|bachelor of science)\b",
    r"\b(b\.?com|bachelor of commerce)\b",
    r"\b(m\.?sc|master of science)\b",
    # School-level qualifications
    r"\b(12th|12 th|class\s*xii|hsc|higher secondary|intermediate)\b",
    r"\b(10th|10 th|class\s*x|ssc|secondary school|matriculation|matric)\b",
]

INSTITUTION_HINTS = [
    "university", "institute", "college", "school", "academy",
    # Indian premier institutions
    "iit", "nit", "iiit", "bits", "iim", "iisc",
    # School boards
    "cbse", "icse", "igcse", "state board",
]


def _extract_education_section(text: str) -> str:
    """Extract the education section from raw resume text."""
    for header in EDUCATION_HEADERS:
        pattern = rf"{header}.*?(?=\n[A-Z][^\n]{{0,30}}\n|\Z)"
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(0)
    return text  # fallback: scan full resume


def _extract_institution_from_line(line: str) -> str:
    """
    Extract institution name from a single line.
    Splits by comma, returns the first part containing an institution hint.
    """
    parts = [p.strip() for p in line.split(",")]
    for part in parts:
        part_lower = part.lower()
        for hint in INSTITUTION_HINTS:
            if hint in part_lower:
                return part
    return ""


def _extract_degree_label_from_line(line: str) -> str:
    """
    Extract just the degree phrase from a line.
    Returns the first comma-separated part that matches a degree pattern.
    """
    parts = [p.strip() for p in line.split(",")]
    for part in parts:
        for pattern in DEGREE_PATTERNS:
            if re.search(pattern, part, re.IGNORECASE):
                return part
    return line.strip()  # fallback: return full line


def _extract_year_from_text(text: str) -> str:
    """Extract a 4-digit year from text."""
    match = re.search(r"(19|20)\d{2}", text)
    return match.group(0) if match else ""


def _extract_education_from_text(resume_text: str) -> List[Dict[str, Any]]:
    """
    Parse education entries directly from raw resume text.
    Used as a fallback/enrichment when parsed education data is missing fields.
    """
    section = _extract_education_section(resume_text)
    lines = section.split("\n")
    education_list = []

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        # Only process lines that contain a recognisable degree keyword
        matched = any(
            re.search(pattern, line_clean, re.IGNORECASE)
            for pattern in DEGREE_PATTERNS
        )
        if not matched:
            continue

        degree = _extract_degree_label_from_line(line_clean)
        institution = _extract_institution_from_line(line_clean)
        year = _extract_year_from_text(line_clean)

        education_list.append({
            "degree": degree,
            "institution": institution,
            "year": year,
        })

    return education_list


def _enrich_education_entries(
    parsed_education: List[Dict[str, Any]],
    resume_text: str,
) -> List[Dict[str, Any]]:
    """
    Enrich already-parsed education entries with extracted data from raw text.

    Rules:
    - If the parsed list is empty, fall back entirely to text extraction.
    - If an entry is missing institution or degree, try to fill it from the
      closest text-extracted entry (matched by year).
    """
    if not parsed_education and resume_text:
        return _extract_education_from_text(resume_text)

    if not resume_text:
        return parsed_education

    # Build a lookup from year → text-extracted entry for gap-filling
    text_entries = _extract_education_from_text(resume_text)
    text_by_year: Dict[str, Dict[str, Any]] = {}
    for entry in text_entries:
        yr = entry.get("year", "")
        if yr:
            text_by_year[yr] = entry

    enriched = []
    for entry in parsed_education:
        e = dict(entry)  # shallow copy to avoid mutating state
        yr = _extract_year_from_text(e.get("year", "") or e.get("degree", ""))
        text_match = text_by_year.get(yr, {})

        # Fill missing institution
        if not (e.get("institution") or "").strip() and text_match.get("institution"):
            e["institution"] = text_match["institution"]

        # Fill missing/malformed degree (when degree == full raw line)
        degree_val = (e.get("degree") or "").strip()
        if text_match.get("degree") and (
            not degree_val
            or "," in degree_val  # looks like it still contains institution/year
        ):
            e["degree"] = text_match["degree"]

        # Fill missing year
        if not (e.get("year") or "").strip() and yr:
            e["year"] = yr

        enriched.append(e)

    return enriched


# ─────────────────────────────────────────────────────────────────────────────
# Soft Skills
# ─────────────────────────────────────────────────────────────────────────────

SOFT_SKILL_CATEGORIES = {
    "leadership": [
        "leadership", "leading", "lead", "managed team", "team lead", "tech lead",
        "mentored", "mentorship", "supervised", "directed", "headed", "chaired",
        "oversaw", "coordinated team", "driven", "driving", "spearheaded",
        "captain", "founder", "co-founder", "principal", "architect",
    ],
    "collaboration": [
        "collaboration", "collaborated", "teamwork", "cross-functional",
        "cross functional", "stakeholder", "stakeholders", "partnered",
        "cooperation", "cooperative", "team player", "working with",
        "coordinated with", "aligned with", "engaged with", "interdisciplinary",
    ],
    "communication": [
        "communication", "communicated", "presented", "presentation", "writing",
        "written", "verbal", "interpersonal", "documentation", "reporting",
        "articulate", "conveyed", "facilitated", "moderated", "public speaking",
        "negotiation", "negotiated", "influenced", "storytelling",
    ],
    "problem_solving": [
        "problem solving", "problem-solving", "analytical", "analysis",
        "analyzed", "debugging", "debugged", "troubleshooting", "troubleshoot",
        "root cause", "solution", "solved", "resolved", "investigated",
        "diagnosed", "critical thinking", "logical", "reasoning", "strategic",
        "optimization", "optimized", "improved efficiency", "reduced",
        "increased", "enhanced", "data-driven", "data driven",
    ],
    "ownership": [
        "ownership", "owned", "took ownership", "end-to-end", "end to end",
        "full lifecycle", "full stack", "full-stack", "responsible for",
        "accountable", "drove", "driven", "initiated", "initiative",
        "proactive", "self-starter", "self starter", "autonomous",
        "independently", "solo", "delivered", "shipped", "launched",
    ],
    "adaptability": [
        "adaptability", "adaptable", "adapted", "flexible", "agile",
        "pivot", "pivoted", "rapidly changing", "fast-paced", "fast paced",
        "multi-tasking", "multitasking", "context switching", "learned quickly",
        "quick learner", "self-learning", "self learning", "upskilled",
        "reskilled", "new domain", "unfamiliar", "stretch assignment",
    ],
}


def _normalize_text(text: str) -> str:
    """Normalize text for matching."""
    return (text or "").lower().strip()


def _detect_soft_skill_category(category: str, text: str) -> bool:
    """Check if a soft skill category is present in text."""
    text_lower = _normalize_text(text)
    if not text_lower:
        return False
    keywords = SOFT_SKILL_CATEGORIES.get(category, [])
    for keyword in keywords:
        if keyword in text_lower:
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Experience / Education Merging
# ─────────────────────────────────────────────────────────────────────────────

def _merge_experience_roles(experience: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merge and deduplicate experience entries by company+title."""
    if not experience:
        return []
    seen: Set[str] = set()
    merged = []
    for exp in experience:
        company = (exp.get("company") or "").strip().lower()
        title = (exp.get("title") or "").strip().lower()
        key = f"{company}::{title}"
        if key and key not in seen:
            seen.add(key)
            merged.append(exp)
    return merged


def _merge_education_entries(education: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merge and deduplicate education entries by institution+degree."""
    if not education:
        return []
    seen: Set[str] = set()
    merged = []
    for edu in education:
        institution = (edu.get("institution") or "").strip().lower()
        degree = (edu.get("degree") or "").strip().lower()
        key = f"{institution}::{degree}"
        if key and key not in seen:
            seen.add(key)
            merged.append(edu)
    return merged


# ─────────────────────────────────────────────────────────────────────────────
# Scoring Functions
# ─────────────────────────────────────────────────────────────────────────────

def _calculate_skill_match_pct(
    resume_skills: List[str],
    jd_required_skills: List[str],
    jd_preferred_skills: List[str],
    resume_text: str = "",
) -> float:
    """Calculate skill match percentage (0-100) using consistent matching logic."""
    all_jd_skills = []
    seen = set()
    for skill in jd_required_skills:
        ns = _normalize_text(skill)
        if ns and ns not in seen:
            seen.add(ns)
            all_jd_skills.append(skill)
    for skill in jd_preferred_skills:
        ns = _normalize_text(skill)
        if ns and ns not in seen:
            seen.add(ns)
            all_jd_skills.append(skill)
    if not all_jd_skills:
        return 100.0
    matches = sum(
        1 for jd_skill in all_jd_skills
        if _skill_matches(jd_skill, resume_skills, resume_text)
    )
    return round((matches / len(all_jd_skills)) * 100, 1)


def _calculate_core_strengths_score(resume_text: str, experience: List[Dict[str, Any]]) -> dict:
    """Calculate core strengths score based on soft skill category detection."""
    text_to_analyze = _normalize_text(resume_text)
    for exp in experience:
        desc = exp.get("description") or ""
        if desc:
            text_to_analyze += " " + _normalize_text(desc)

    categories_detected = {
        category: _detect_soft_skill_category(category, text_to_analyze)
        for category in SOFT_SKILL_CATEGORIES.keys()
    }
    matched_count = sum(1 for v in categories_detected.values() if v)
    total_categories = len(SOFT_SKILL_CATEGORIES)

    return {
        "score": round((matched_count / total_categories) * 100, 1),
        "categories_detected": {k: v for k, v in categories_detected.items() if v},
        "categories_missed": [k for k, v in categories_detected.items() if not v],
        "matched_count": matched_count,
        "total_categories": total_categories,
    }


def _calculate_education_score(
    education: List[Dict[str, Any]],
    resume_text: str = "",        # NEW: pass resume_text for enrichment
) -> dict:
    """
    Calculate education score based on entry count, degree level, and institution quality.
    Education entries are first enriched from raw resume text to fix missing/malformed fields.
    """
    # ── NEW: enrich parsed entries with text-extracted data ──────────────────
    enriched_education = _enrich_education_entries(education, resume_text)
    merged_edu = _merge_education_entries(enriched_education)
    # ─────────────────────────────────────────────────────────────────────────

    entry_count = len(merged_edu)

    degree_levels = {
        "phd": 10.0, "doctorate": 10.0,
        "master": 7.0, "mba": 7.0, "ms": 7.0, "ma": 7.0,
        "m.tech": 7.0, "m.e.": 7.0,
        "bachelor": 4.0, "bs": 4.0, "ba": 4.0,
        "b.tech": 4.0, "b.e.": 4.0, "b.sc": 3.0, "b.com": 3.0,
        "associate": 2.0, "diploma": 2.0,
        # School level (new)
        "12th": 1.0, "hsc": 1.0, "higher secondary": 1.0, "intermediate": 1.0,
        "10th": 0.5, "ssc": 0.5, "secondary": 0.5, "matriculation": 0.5,
    }

    top_institution_keywords = [
        "iit", "nit", "iiit", "bits", "iim", "iisc",
        "mit", "stanford", "harvard", "caltech", "berkeley", "carnegie mellon",
        "oxford", "cambridge", "imperial", "eth", "epfl",
        "university of", "institute of technology",
    ]

    # 1. Base score from entry count (max 60 points)
    base_score = {0: 0.0, 1: 30.0, 2: 50.0}.get(entry_count, 60.0)

    # 2. Degree level bonus (max 25 points)
    degree_bonus = 0.0
    for edu in merged_edu:
        degree = (edu.get("degree", "") or "").lower()
        for kw, points in degree_levels.items():
            if kw in degree:
                degree_bonus += points
                break
    degree_bonus = min(degree_bonus, 25.0)

    # 3. Institution prestige bonus (max 15 points)
    institution_bonus = 0.0
    for edu in merged_edu:
        institution = (edu.get("institution", "") or "").lower()
        for keyword in top_institution_keywords:
            if keyword in institution:
                institution_bonus += 5.0
                break
    institution_bonus = min(institution_bonus, 15.0)

    score = round(
        min(100.0, max(0.0, base_score + degree_bonus + institution_bonus)), 1
    )

    return {
        "score": score,
        "entry_count": entry_count,
        "degree_bonus": round(degree_bonus, 1),
        "institution_bonus": round(institution_bonus, 1),
        "entries": merged_edu,
    }


def _parse_duration_years(duration_str: str) -> float:
    """Parse duration string to years (e.g., '2020-2023' -> 3.0, '3 years' -> 3.0)."""
    if not duration_str:
        return 0.0
    range_match = re.search(r'(\d{4})\s*[-–]\s*(\d{4}|Present|present)', duration_str)
    if range_match:
        start_year = int(range_match.group(1))
        end_str = range_match.group(2)
        end_year = 2026 if end_str.lower() == 'present' else int(end_str)
        return max(0.5, end_year - start_year)
    years_match = re.search(r'(\d+(?:\.\d+)?)\s*years?', duration_str, re.IGNORECASE)
    if years_match:
        return float(years_match.group(1))
    return 1.0


def _calculate_experience_score(experience: List[Dict[str, Any]]) -> dict:
    """
    Calculate experience score based on role count, duration, and seniority signals.
    """
    merged_exp = _merge_experience_roles(experience)
    role_count = len(merged_exp)

    senior_keywords = [
        "senior", "lead", "principal", "staff", "chief", "head", "director",
        "vp", "vice president", "manager", "architect", "founder", "co-founder",
    ]

    base_score = {0: 0.0, 1: 25.0, 2: 40.0, 3: 50.0, 4: 55.0}.get(role_count, 60.0)

    total_years = sum(_parse_duration_years(exp.get("duration", "")) for exp in merged_exp)
    duration_bonus = (min(total_years, 15.0) / 15.0) * 25.0

    seniority_bonus = 0.0
    for exp in merged_exp:
        title = (exp.get("title", "") or "").lower()
        if any(kw in title for kw in senior_keywords):
            seniority_bonus += 3.0
    seniority_bonus = min(seniority_bonus, 15.0)

    score = round(min(100.0, max(0.0, base_score + duration_bonus + seniority_bonus)), 1)

    return {
        "score": score,
        "role_count": role_count,
        "total_years": round(total_years, 1),
        "seniority_bonus": round(seniority_bonus, 1),
        "roles": [
            {
                "title": exp.get("title", ""),
                "company": exp.get("company", ""),
                "duration": exp.get("duration", ""),
            }
            for exp in merged_exp
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main Agent Node
# ─────────────────────────────────────────────────────────────────────────────

def kpi_agent(state: ATSState) -> ATSState:
    """
    KPI Evaluation Agent (Node) - Fully Deterministic

    Calculates 4 key metrics:
    1. Technology Stack (skill match %)
    2. Core Strengths (soft skills category detection)
    3. Education (enriched from raw resume text, capped at 100)
    4. Experience (role count based, capped at 100)
    """
    logger.info("kpi_agent_start", candidate_id=state["candidate_id"])

    resume_skills = state.get("resume_skills", []) or []
    jd_required   = state.get("jd_required_skills", []) or []
    jd_preferred  = state.get("jd_preferred_skills", []) or []
    resume_text   = state.get("resume_text", "") or ""
    experience    = state.get("resume_experience", []) or []
    education     = state.get("resume_education", []) or []

    # ── 1. Technology Stack Score ────────────────────────────────────────────
    all_jd_skills: List[str] = []
    seen: Set[str] = set()
    for skill in jd_required + jd_preferred:
        ns = _normalize_text(skill)
        if ns and ns not in seen:
            seen.add(ns)
            all_jd_skills.append(skill)

    skills_matched     = [s for s in all_jd_skills if _skill_matches(s, resume_skills, resume_text)]
    skills_not_matched = [s for s in all_jd_skills if not _skill_matches(s, resume_skills, resume_text)]

    tech_stack_score = (
        round((len(skills_matched) / len(all_jd_skills)) * 100, 1)
        if all_jd_skills else 100.0
    )

    # ── 2. Core Strengths Score ──────────────────────────────────────────────
    core_strengths = _calculate_core_strengths_score(resume_text, experience)

    # ── 3. Education Score (now passes resume_text for enrichment) ───────────
    education_result = _calculate_education_score(education, resume_text)

    # ── 4. Experience Score ──────────────────────────────────────────────────
    experience_result = _calculate_experience_score(experience)

    # ── Key Signals ──────────────────────────────────────────────────────────
    key_signals = []

    if tech_stack_score >= 80:
        key_signals.append(f"Strong tech match ({tech_stack_score}%)")
    elif tech_stack_score >= 50:
        key_signals.append(f"Moderate tech match ({tech_stack_score}%)")
    else:
        key_signals.append(f"Limited tech match ({tech_stack_score}%)")

    core_matched = core_strengths["matched_count"]
    core_total   = core_strengths["total_categories"]
    key_signals.append(f"{core_matched}/{core_total} soft skills detected")

    role_count = experience_result["role_count"]
    if role_count > 0:
        key_signals.append(f"{role_count} role{'s' if role_count > 1 else ''} experience")

    edu_count = education_result["entry_count"]
    if edu_count > 0:
        key_signals.append(f"{edu_count} education credential{'s' if edu_count > 1 else ''}")

    # ── Build evaluation_breakdown ───────────────────────────────────────────
    evaluation_breakdown = {
        "technology_stack": {
            "score": tech_stack_score,
            "skills_matched_count": len(skills_matched),
            "total_jd_skills": len(all_jd_skills),
            "skills_matched": skills_matched,
            "skills_not_matched": skills_not_matched,
        },
        "core_strengths": {
            "score": core_strengths["score"],
            "categories_detected": list(core_strengths["categories_detected"].keys()),
            "categories_missed": core_strengths["categories_missed"],
            "matched_count": core_strengths["matched_count"],
            "total_categories": core_strengths["total_categories"],
        },
        "education": {
            "score": education_result["score"],
            "entry_count": education_result["entry_count"],
            "entries": [
                {
                    "degree":      e.get("degree", ""),
                    "institution": e.get("institution", ""),
                    "year":        e.get("year", ""),
                }
                for e in education_result["entries"]
            ],
        },
        "experience": {
            "score":      experience_result["score"],
            "role_count": experience_result["role_count"],
            "roles":      experience_result["roles"],
        },
        "key_signals": key_signals,
    }

    logger.info(
        "kpi_agent_complete",
        candidate_id=state["candidate_id"],
        tech_score=tech_stack_score,
        core_strengths_score=core_strengths["score"],
        education_score=education_result["score"],
        experience_score=experience_result["score"],
    )

    return {"evaluation_breakdown": evaluation_breakdown}