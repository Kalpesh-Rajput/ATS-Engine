import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_recruiter
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.recruiter import Recruiter
from app.schemas.candidate import CandidateListResponse, CandidateResponse, ShortlistRequest

router = APIRouter()


@router.get("/", response_model=CandidateListResponse)
async def list_candidates(
    job_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    try:
        q = select(Candidate).options(selectinload(Candidate.scoring_job))
        if not current.is_admin:
            q = q.where(Candidate.recruiter_id == current.id)
        if job_id:
            q = q.where(Candidate.scoring_job_id == job_id)
        if status:
            q = q.where(Candidate.status == status)
        if review_status:
            q = q.where(Candidate.review_status == review_status)
        if min_score is not None:
            q = q.where(Candidate.ats_score >= min_score)

        total = await db.scalar(select(func.count()).select_from(q.subquery()))
        result = await db.execute(
            q.order_by(Candidate.ats_score.desc().nullslast())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        candidates = result.scalars().all()
        return CandidateListResponse(
            candidates=candidates,
            total=total or 0,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error listing candidates: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list candidates: {str(e)}")


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    result = await db.execute(
        select(Candidate)
        .where(Candidate.id == candidate_id)
        .options(selectinload(Candidate.scoring_job))
    )
    c = result.scalar_one_or_none()
    if not c or (not current.is_admin and str(c.recruiter_id) != str(current.id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return c


class ReviewStatusRequest(BaseModel):
    review_status: str


@router.post("/shortlist", status_code=status.HTTP_200_OK)
async def shortlist_candidates(
    payload: ShortlistRequest,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id.in_(payload.candidate_ids),
            Candidate.recruiter_id == current.id,
        )
    )
    candidates = result.scalars().all()
    for c in candidates:
        c.review_status = "shortlisted"
    current.total_shortlisted += len(candidates)
    await db.flush()
    await db.commit()
    return {"shortlisted": len(candidates)}


@router.patch("/{candidate_id}/review-status", response_model=CandidateResponse)
async def update_review_status(
    candidate_id: uuid.UUID,
    payload: ReviewStatusRequest,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    allowed_statuses = {"in_process", "shortlisted", "not_shortlisted", "selected"}
    if payload.review_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"review_status must be one of {', '.join(sorted(allowed_statuses))}",
        )

    result = await db.execute(
        select(Candidate)
        .where(Candidate.id == candidate_id)
        .options(selectinload(Candidate.scoring_job))
    )
    c = result.scalar_one_or_none()
    if not c or (not current.is_admin and str(c.recruiter_id) != str(current.id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    c.review_status = payload.review_status
    await db.flush()
    await db.refresh(c)
    return c


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    c = await db.get(Candidate, candidate_id)
    if not c or (not current.is_admin and str(c.recruiter_id) != str(current.id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    await db.delete(c)
    await db.commit()
