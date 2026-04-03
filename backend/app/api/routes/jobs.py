import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_recruiter
from app.db.session import get_db
from app.core.config import settings
from app.models.candidate import Candidate
from app.models.recruiter import Recruiter
from app.models.scoring_job import ScoringJob
from app.schemas.job import JobStatusResponse, ScoringJobResponse
from app.services.tasks import run_scoring_pipeline

router = APIRouter()

ALLOWED_MIME = {"application/pdf"}


def _save_file(content: bytes, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return str(dest)


@router.get("/", response_model=list[ScoringJobResponse])
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    result = await db.execute(
        select(ScoringJob)
        .where(ScoringJob.recruiter_id == current.id)
        .order_by(ScoringJob.created_at.desc())
    )
    jobs = result.scalars().all()
    out: list[ScoringJobResponse] = []
    for j in jobs:
        job_title = (j.meta or {}).get("job_title") if j.meta else None
        if not job_title:
            # Backfill for jobs created before `meta.job_title` existed.
            job_title = (
                await db.scalar(
                    select(Candidate.job_applied)
                    .where(Candidate.scoring_job_id == j.id)
                    .limit(1)
                )
            )
        out.append(
            ScoringJobResponse(
                id=j.id,
                recruiter_id=j.recruiter_id,
                celery_task_id=j.celery_task_id,
                jd_path=j.jd_path,
                job_title=job_title,
                status=j.status,
                total_candidates=j.total_candidates,
                processed_candidates=j.processed_candidates,
                failed_candidates=j.failed_candidates,
                error_message=j.error_message,
                created_at=j.created_at,
                completed_at=j.completed_at,
            )
        )
    return out


@router.get("/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    job = await db.get(ScoringJob, job_id)
    if not job or str(job.recruiter_id) != str(current.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    progress = 0.0
    if job.total_candidates > 0:
        progress = round((job.processed_candidates / job.total_candidates) * 100, 1)

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        progress_pct=progress,
        total=job.total_candidates,
        processed=job.processed_candidates,
        failed=job.failed_candidates,
        completed_at=job.completed_at,
    )


@router.get("/{job_id}", response_model=ScoringJobResponse)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    job = await db.get(ScoringJob, job_id)
    if not job or str(job.recruiter_id) != str(current.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    job_title = (job.meta or {}).get("job_title") if job.meta else None
    if not job_title:
        job_title = await db.scalar(
            select(Candidate.job_applied)
            .where(Candidate.scoring_job_id == job.id)
            .limit(1)
        )

    return ScoringJobResponse(
        id=job.id,
        recruiter_id=job.recruiter_id,
        celery_task_id=job.celery_task_id,
        jd_path=job.jd_path,
        job_title=job_title,
        status=job.status,
        total_candidates=job.total_candidates,
        processed_candidates=job.processed_candidates,
        failed_candidates=job.failed_candidates,
        error_message=job.error_message,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


@router.post("/{job_id}/add-candidates", response_model=ScoringJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def add_candidates_to_job(
    job_id: uuid.UUID,
    resumes: List[UploadFile] = File(..., description="Candidate resume PDFs"),
    linkedin_profiles: List[UploadFile] = File(..., description="LinkedIn profile PDFs (same order as resumes)"),
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    job = await db.get(ScoringJob, job_id)
    if not job or str(job.recruiter_id) != str(current.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if len(resumes) != len(linkedin_profiles):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Number of resumes must match number of LinkedIn profiles",
        )
    if not resumes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one resume required")
    if not job.jd_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job missing JD file path")

    job_title = (job.meta or {}).get("job_title") if job.meta else None
    if not job_title:
        # Backfill for jobs created before `meta.job_title` existed.
        job_title = await db.scalar(
            select(Candidate.job_applied)
            .where(Candidate.scoring_job_id == job_id)
            .limit(1)
        )
        if job_title:
            meta = job.meta or {}
            meta["job_title"] = job_title
            job.meta = meta
            await db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Job missing job title (unable to backfill). Please reload session.",
            )

    # Validate mime types
    for f in resumes + linkedin_profiles:
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

    # Reuse the job folder from jd_path:
    # <job_dir>/jd/<jd_filename>  -> job_dir is two parents up.
    job_dir = Path(job.jd_path).parent.parent
    base_resumes_dir = job_dir / "resumes"
    base_linkedin_dir = job_dir / "linkedin"

    candidate_payloads = []
    for resume, linkedin in zip(resumes, linkedin_profiles):
        cand_id = uuid.uuid4()
        res_bytes = await resume.read()
        li_bytes = await linkedin.read()

        res_path = _save_file(res_bytes, base_resumes_dir / f"{cand_id}_{resume.filename}")
        li_path = _save_file(li_bytes, base_linkedin_dir / f"{cand_id}_{linkedin.filename}")

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
        candidate_payloads.append(
            {
                "candidate_id": str(cand_id),
                "resume_path": res_path,
                "linkedin_path": li_path,
            }
        )

    # Update job totals for the appended batch.
    job.total_candidates += len(resumes)
    job.status = "pending"
    job.completed_at = None
    job.error_message = None
    await db.flush()

    # Persist rows before dispatching Celery.
    await db.commit()

    # Dispatch Celery task for ONLY the newly added candidates.
    task = run_scoring_pipeline.delay(
        job_id=str(job_id),
        recruiter_id=str(current.id),
        jd_path=job.jd_path,
        job_title=job_title,
        candidates=candidate_payloads,
    )
    job.celery_task_id = task.id
    await db.flush()
    await db.commit()

    return ScoringJobResponse(
        id=job.id,
        recruiter_id=job.recruiter_id,
        celery_task_id=job.celery_task_id,
        jd_path=job.jd_path,
        job_title=job_title,
        status=job.status,
        total_candidates=job.total_candidates,
        processed_candidates=job.processed_candidates,
        failed_candidates=job.failed_candidates,
        error_message=job.error_message,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )
