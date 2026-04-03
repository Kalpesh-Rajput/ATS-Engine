import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class RecruiterCreate(BaseModel):
    user_name: str
    email: EmailStr
    password: str


class RecruiterUpdate(BaseModel):
    user_name: Optional[str] = None
    email: Optional[EmailStr] = None


class RecruiterResponse(BaseModel):
    id: uuid.UUID
    user_name: str
    email: EmailStr
    is_active: bool
    is_admin: bool
    total_resumes_uploaded: int
    total_shortlisted: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RecruiterStats(BaseModel):
    total_resumes_uploaded: int
    total_shortlisted: int
    total_jobs: int
