"""
Centralised prompt templates for every agent.
Keeping prompts here makes A/B testing and iteration easy.
"""

# ─── Parser Agent ────────────────────────────────────────────────

PARSER_SYSTEM = """You are a precise resume parser. Extract structured information from the resume text provided.
Return ONLY valid JSON — no markdown, no preamble, no explanation.
If a field is not present, use null.
"""

PARSER_PROMPT = """Extract the following fields from this resume:

RESUME TEXT:
{resume_text}

STRICT SKILL EXTRACTION RULES:
- Return skills as SHORT, ATOMIC skill names only (1-8 words each), not sentences.
- Do NOT include explanations, responsibilities, or full bullet points.
- Preserve acronyms and standards exactly when possible (e.g., AWS, Azure, GCP, SQL, BGP, OSPF, CCNA, PCNSA).
- Split combined phrases into separate skills when needed.
  Example: "Network security, routing and switching" -> ["Network security", "Routing", "Switching"]
- Deduplicate near-duplicates and normalize casing (e.g., "aws" -> "AWS", "python" -> "Python").
- If certifications are mentioned, include cert names in skills (e.g., "AWS Solutions Architect Associate", "CCNA").

Return JSON with this exact schema:
{{
  "name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "skills": ["list", "of", "skills"],
  "experience": [
    {{
      "title": "Job Title",
      "company": "Company Name",
      "duration": "2020 - 2023",
      "description": "brief description"
    }}
  ],
  "education": [
    {{
      "degree": "B.Tech Computer Science",
      "institution": "IIT Bombay",
      "year": "2018"
    }}
  ]
}}
"""

# ─── JD Parser ───────────────────────────────────────────────────

JD_PARSER_SYSTEM = """You are a job description analyser. Extract skills and requirements.
Return ONLY valid JSON."""

JD_PARSER_PROMPT = """Analyse this job description and extract required and preferred skills.

JOB DESCRIPTION:
{jd_text}

STRICT JD SKILL RULES:
- Return atomic, concise skills (1-8 words), not full requirement sentences.
- Keep semantic meaning but remove filler words.
  Example: "Hands-on experience with firewall policy design and troubleshooting"
  -> "Firewall policy design", "Firewall troubleshooting".
- Keep grouped alternatives in one normalized entry where useful:
  Example: "Cloud certifications (AWS, Azure, or equivalent)"
  -> "Cloud certifications (AWS/Azure/equivalent)".
- Prefer concrete technical skills/tools over generic phrases.
- Deduplicate similar skills and keep output clean.

Return JSON:
{{
  "required_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill3", "skill4"],
  "experience_years": "3-5 years or null",
  "role_summary": "one sentence summary of the role"
}}
"""

# ─── Scorer Agent ────────────────────────────────────────────────

SCORER_SYSTEM = """You are an expert ATS scoring engine. Evaluate candidate resumes against job descriptions.
You must return four percentage sub-scores that add up logically to the overall ATS score.
Return ONLY valid JSON."""

SCORER_PROMPT = """Score this candidate against the job description.

JOB DESCRIPTION:
{jd_text}

CANDIDATE RESUME:
{resume_text}

JD REQUIRED SKILLS: {required_skills}
JD PREFERRED SKILLS: {preferred_skills}
CANDIDATE SKILLS: {candidate_skills}

MATCHING POLICY (for skills):
- Treat alternatives as satisfied if ANY option matches.
  Example: "AWS/Azure/equivalent" is matched if candidate has AWS OR Azure OR equivalent cloud cert.
- Do not mark a requirement as mismatch when candidate evidence clearly indicates partial/alternative satisfaction.
- Keep `skills_matched` and `skills_not_matched` as clean atomic skill names, not long sentences.

SCORING CRITERIA (WEIGHTED):
- Skills match (70% of total ATS score)
  - First, compute SKILL_MATCH_PCT = percentage of JD skills (required + preferred) that the candidate has.
  - Then this sub-score contributes 70% of the final ATS score.
- Experience relevance (20% of total)
  - EXPERIENCE_PCT: 0–100 based on role alignment, seniority fit, and relevant technologies.
- Education fit (5% of total)
  - EDUCATION_PCT: 0–100 based on degree relevance and level.
- Overall profile strength (5% of total)
  - PROFILE_PCT: 0–100 for clarity, achievements, progression, and overall impression.

You MUST output these fields as percentages in the range 0–100:
- "skills_match_pct"
- "experience_relevance_pct"
- "education_fit_pct"
- "profile_strength_pct"

IMPORTANT for "pros" and "cons":
- Write 2–4 short qualitative sentences each (strengths / gaps in fit, seniority, domain, communication, trajectory).
- Do NOT copy-paste lists from skills_matched or skills_not_matched as pros/cons bullets.
- Do NOT output bare skill tokens (e.g. "TypeScript", "Python") as standalone pros/cons lines.

Return JSON:
{{
  "skills_match_pct": 72.5,
  "experience_relevance_pct": 80.0,
  "education_fit_pct": 60.0,
  "profile_strength_pct": 75.0,
  "ats_score": 78.5,
  "skills_matched": ["Python", "FastAPI"],
  "skills_not_matched": ["Kubernetes", "Terraform"],
  "main_summary": "3-4 sentence summary of candidate fit for this role",
  "pros": ["Strong Python background", "Relevant industry experience"],
  "cons": ["No cloud infrastructure experience", "Short tenure at previous roles"]
}}
"""

# ─── LinkedIn Agent ──────────────────────────────────────────────

LINKEDIN_SYSTEM = """You are a profile consistency analyser. Compare a candidate's resume with their LinkedIn profile.
Identify inconsistencies that could indicate resume inflation.
Return ONLY valid JSON."""

LINKEDIN_PROMPT = """Compare this candidate's resume with their LinkedIn profile.

RESUME:
{resume_text}

LINKEDIN PROFILE:
{linkedin_text}

Check for inconsistencies in:
1. Job titles and companies
2. Employment dates and durations
3. Skills listed
4. Education details
5. Overall story consistency

Return JSON:
{{
  "linkedin_match_score": 85.0,
  "linkedin_flag": "green",
  "inconsistencies": [
    "Resume lists 'Senior Engineer' at XYZ Corp but LinkedIn shows 'Engineer'"
  ],
  "linkedin_summary": "2-3 sentence summary of profile consistency and any red flags"
}}

linkedin_flag must be "green" if score >= 70, otherwise "red".
"""

# ─── Evaluator Agent (LLM-as-Judge) ──────────────────────────────

EVALUATOR_SYSTEM = """You are a light ATS output reviewer.
Give brief, optional observations only. Do not reject candidates.
Return ONLY valid JSON."""

EVALUATOR_PROMPT = """Review this ATS bundle for logging only (not for blocking).

Check lightly:
- ats_score looks like a number 0–100
- main_summary is non-empty text

Do NOT return FAIL. Always use verdict PASS for the pipeline.
You may add short optional notes if something looks odd.

CANDIDATE EVALUATION PAYLOAD:
{evaluation_payload}

Return JSON:
{{
  "verdict": "PASS",
  "confidence": 0.9,
  "reasons": ["optional observation 1"],
  "notes": ["optional note"],
  "required_fixes": []
}}
"""
