import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

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
    min_score: Optional[float] = Query(None, ge=0, le=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    q = select(Candidate).where(Candidate.recruiter_id == current.id)
    if job_id:
        q = q.where(Candidate.scoring_job_id == job_id)
    if status:
        q = q.where(Candidate.status == status)
    if min_score is not None:
        q = q.where(Candidate.ats_score >= min_score)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(
        q.order_by(Candidate.ats_score.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return CandidateListResponse(
        candidates=result.scalars().all(),
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    c = await db.get(Candidate, candidate_id)
    if not c or str(c.recruiter_id) != str(current.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return c


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
        c.status = "shortlisted"
    current.total_shortlisted += len(candidates)
    await db.flush()
    return {"shortlisted": len(candidates)}


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Recruiter = Depends(get_current_recruiter),
):
    c = await db.get(Candidate, candidate_id)
    if not c or str(c.recruiter_id) != str(current.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    await db.delete(c)
