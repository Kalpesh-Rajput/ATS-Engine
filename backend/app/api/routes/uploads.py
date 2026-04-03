import os
import uuid
from pathlib import Path
from typing import List

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
from app.services.tasks import run_scoring_pipeline

router = APIRouter()

ALLOWED_MIME = {"application/pdf"}


def _save_file(content: bytes, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return str(dest)


@router.post("/", response_model=ScoringJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_and_trigger(
    job_description: UploadFile = File(..., description="Job Description PDF"),
    resumes: List[UploadFile] = File(..., description="Candidate resume PDFs"),
    linkedin_profiles: List[UploadFile] = File(..., description="LinkedIn profile PDFs (same order as resumes)"),
    job_title: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    # Validate counts
    if len(resumes) != len(linkedin_profiles):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Number of resumes must match number of LinkedIn profiles",
        )
    if not resumes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one resume required")

    # Validate mime types
    all_files = [job_description] + resumes + linkedin_profiles
    for f in all_files:
        if f.content_type not in ALLOWED_MIME:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"{f.filename} is not a PDF",
            )
        if f.size and f.size > settings.max_file_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{f.filename} exceeds {settings.MAX_FILE_SIZE_MB} MB limit",
            )

    base_dir = Path(settings.UPLOAD_DIR) / str(current.id)
    job_id = uuid.uuid4()
    job_dir = base_dir / str(job_id)

    # Save JD
    jd_bytes = await job_description.read()
    jd_path = _save_file(jd_bytes, job_dir / "jd" / job_description.filename)

    # Create scoring job record
    scoring_job = ScoringJob(
        id=job_id,
        recruiter_id=current.id,
        jd_path=jd_path,
        status="pending",
        total_candidates=len(resumes),
        meta={"job_title": job_title},
    )
    db.add(scoring_job)
    await db.flush()

    # Save files and create candidate records
    candidate_payloads = []
    for i, (resume, linkedin) in enumerate(zip(resumes, linkedin_profiles)):
        cand_id = uuid.uuid4()
        res_bytes = await resume.read()
        li_bytes = await linkedin.read()

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

    # Dispatch Celery task
    task = run_scoring_pipeline.delay(
        job_id=str(job_id),
        recruiter_id=str(current.id),
        jd_path=jd_path,
        job_title=job_title,
        candidates=candidate_payloads,
    )
    scoring_job.celery_task_id = task.id
    await db.flush()

    logger.info("scoring_job_created", job_id=str(job_id), candidate_count=len(resumes))
    return scoring_job
