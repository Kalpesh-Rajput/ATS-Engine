from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.recruiter import Recruiter
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.schemas.recruiter import RecruiterCreate, RecruiterResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Recruiter).where(Recruiter.email == payload.email))
    recruiter = result.scalar_one_or_none()

    if not recruiter:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not found",
        )
    if not recruiter.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    if not verify_password(payload.password, recruiter.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token_data = {"sub": str(recruiter.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        recruiter_id = data.get("sub")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(select(Recruiter).where(Recruiter.id == recruiter_id))
    recruiter = result.scalar_one_or_none()
    if not recruiter or not recruiter.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Recruiter not found")

    token_data = {"sub": str(recruiter.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/register", response_model=RecruiterResponse, status_code=status.HTTP_201_CREATED)
async def register_recruiter(
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
        post=payload.post,
        phone=payload.phone,
        department=payload.department,
        location=payload.location,
        join_date=payload.join_date,
        is_admin=payload.is_admin,
    )
    db.add(recruiter)
    await db.flush()
    await db.refresh(recruiter)
    await db.commit()
    return RecruiterResponse.model_validate(recruiter)
