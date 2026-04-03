import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_recruiter
from app.core.security import hash_password
from app.db.session import get_db
from app.models.recruiter import Recruiter
from app.models.scoring_job import ScoringJob
from app.schemas.recruiter import RecruiterCreate, RecruiterResponse, RecruiterStats, RecruiterUpdate

router = APIRouter()


@router.get("/me", response_model=RecruiterResponse)
async def get_me(current: Recruiter = Depends(get_current_recruiter)):
    return current


@router.put("/me", response_model=RecruiterResponse)
async def update_me(
    payload: RecruiterUpdate,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    if payload.user_name:
        current.user_name = payload.user_name
    if payload.email:
        current.email = payload.email
    await db.flush()
    return current


@router.get("/me/stats", response_model=RecruiterStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    job_count = await db.scalar(
        select(func.count(ScoringJob.id)).where(ScoringJob.recruiter_id == current.id)
    )
    return RecruiterStats(
        total_resumes_uploaded=current.total_resumes_uploaded,
        total_shortlisted=current.total_shortlisted,
        total_jobs=job_count or 0,
    )


# ─── Admin-only ──────────────────────────────────────────────────

@router.post("/", response_model=RecruiterResponse, status_code=status.HTTP_201_CREATED)
async def create_recruiter(
    payload: RecruiterCreate,
    db: AsyncSession = Depends(get_db),
    _: Recruiter = Depends(get_current_admin),
):
    exists = await db.scalar(select(Recruiter).where(Recruiter.email == payload.email))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    recruiter = Recruiter(
        user_name=payload.user_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(recruiter)
    await db.flush()
    await db.refresh(recruiter)
    return recruiter


@router.get("/", response_model=list[RecruiterResponse])
async def list_recruiters(
    db: AsyncSession = Depends(get_db),
    _: Recruiter = Depends(get_current_admin),
):
    result = await db.execute(select(Recruiter).order_by(Recruiter.created_at.desc()))
    return result.scalars().all()


@router.delete("/{recruiter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recruiter(
    recruiter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Recruiter = Depends(get_current_admin),
):
    r = await db.get(Recruiter, recruiter_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recruiter not found")
    await db.delete(r)
