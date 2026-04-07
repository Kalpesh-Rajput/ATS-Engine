import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class RecruiterCreate(BaseModel):
    user_name: str
    email: EmailStr
    password: str
    post: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    join_date: Optional[date] = None
    is_admin: Optional[bool] = False


class RecruiterUpdate(BaseModel):
    user_name: Optional[str] = None
    email: Optional[EmailStr] = None
    post: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    join_date: Optional[date] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class RecruiterResponse(BaseModel):
    id: uuid.UUID
    user_name: str
    email: EmailStr
    is_active: bool
    is_admin: bool
    post: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    join_date: Optional[date] = None
    total_resumes_uploaded: int
    total_shortlisted: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RecruiterStats(BaseModel):
    total_resumes_uploaded: int
    total_shortlisted: int
    total_jobs: int
