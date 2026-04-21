import os
import uuid
from pathlib import Path
from typing import List

from celery import chain
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_recruiter
from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.recruiter import Recruiter
from app.models.scoring_job import ScoringJob
from app.schemas.job import ScoringJobResponse
from app.agents.guardrails import has_prompt_injection
from app.services.tasks import preprocess_jd, run_scoring_pipeline

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def _save_file(content: bytes, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return str(dest)


@router.post("/", response_model=ScoringJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_and_trigger(
    job_description: UploadFile | None = File(None, description="Job Description document"),
    resumes: List[UploadFile] = File(..., description="Candidate resume documents"),
    linkedin_profiles: List[UploadFile] = File(..., description="LinkedIn profile documents (same order as resumes)"),
    job_title: str = Form(...),
    client_name: str | None = Form(None),
    session_name: str | None = Form(None),
    job_description_text: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    # Input guardrail: basic text validation + injection checks
    if not (job_title or "").strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Job title is required")
    if has_prompt_injection(job_title):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Potential malicious input in job title")

    if not job_description and not (job_description_text or "").strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please upload a JD document or paste the JD text")
    if job_description_text and has_prompt_injection(job_description_text):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Potential malicious input in job description text")

    # Validate counts
    if len(resumes) != len(linkedin_profiles):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Number of resumes must match number of LinkedIn profiles",
        )
    if not resumes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one resume required")

    # Validate mime types
    all_files = resumes + linkedin_profiles
    if job_description:
        all_files.insert(0, job_description)
    for f in all_files:
        filename = f.filename or ""
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"{filename} must be a PDF or Word document (.pdf, .docx)",
            )
        if has_prompt_injection(filename):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{filename} has suspicious input pattern",
            )
        if f.size and f.size > settings.max_file_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{filename} exceeds {settings.MAX_FILE_SIZE_MB} MB limit",
            )

    base_dir = Path(settings.UPLOAD_DIR) / str(current.id)
    job_id = uuid.uuid4()
    job_dir = base_dir / str(job_id)

    # Save JD
    if job_description:
        jd_bytes = await job_description.read()
        if not jd_bytes:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="JD file is empty")
        jd_path = _save_file(jd_bytes, job_dir / "jd" / job_description.filename)
    else:
        jd_text_value = (job_description_text or "").strip()
        if not jd_text_value:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Job description text is empty")
        jd_path = _save_file(jd_text_value.encode('utf-8'), job_dir / "jd" / "jd.txt")

    # Create scoring job record
    scoring_job = ScoringJob(
        id=job_id,
        recruiter_id=current.id,
        jd_path=jd_path,
        jd_text=job_description_text if job_description_text else None,
        status="pending",
        total_candidates=len(resumes),
        meta={
            "job_title": job_title,
            **({"client_name": client_name} if client_name else {}),
            **({"session_name": session_name} if session_name else {}),
        },
    )
    db.add(scoring_job)
    await db.flush()
    await db.commit()

    # Save files and create candidate records
    candidate_payloads = []
    for i, (resume, linkedin) in enumerate(zip(resumes, linkedin_profiles)):
        cand_id = uuid.uuid4()
        res_bytes = await resume.read()
        li_bytes = await linkedin.read()
        if not res_bytes:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{resume.filename} is empty",
            )
        if not li_bytes:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{linkedin.filename} is empty",
            )

        res_path = _save_file(res_bytes, job_dir / "resumes" / f"{cand_id}_{resume.filename}")
        li_path = _save_file(li_bytes, job_dir / "linkedin" / f"{cand_id}_{linkedin.filename}")

        candidate = Candidate(
            id=cand_id,
            recruiter_id=current.id,
            scoring_job_id=job_id,
            job_applied=job_title,
            resume_path=res_path,
            linkedin_path=li_path,
            status="pending",
        )
        db.add(candidate)
        candidate_payloads.append({
            "candidate_id": str(cand_id),
            "resume_path": res_path,
            "linkedin_path": li_path,
        })

    # Update recruiter stats
    current.total_resumes_uploaded += len(resumes)
    await db.flush()
    await db.refresh(scoring_job)

    # Commit before dispatching Celery.
    # Celery workers run in a separate process/connection, so uncommitted rows
    # would cause the worker to not find the job/candidates and leave them stuck in `pending`.
    await db.commit()

    # Dispatch chained Celery tasks:
    # 1) preprocess JD once, 2) score candidate batch
    task = chain(
        preprocess_jd.si(job_id=str(job_id), jd_path=jd_path),
        run_scoring_pipeline.si(
            job_id=str(job_id),
            recruiter_id=str(current.id),
            jd_path=jd_path,
            job_title=job_title,
            candidates=candidate_payloads,
        ),
    ).apply_async()
    scoring_job.celery_task_id = task.id
    await db.flush()
    await db.commit()

    logger.info("scoring_job_created", job_id=str(job_id), candidate_count=len(resumes))
    return scoring_job
