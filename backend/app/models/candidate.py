import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recruiter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recruiters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scoring_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scoring_jobs.id", ondelete="SET NULL"), nullable=True
    )

    # Basic info (extracted by parser agent)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    job_applied: Mapped[Optional[str]] = mapped_column(String(255))

    # File paths
    resume_path: Mapped[Optional[str]] = mapped_column(String(500))
    linkedin_path: Mapped[Optional[str]] = mapped_column(String(500))

    # Scoring
    ats_score: Mapped[Optional[float]] = mapped_column(Float)
    linkedin_match_score: Mapped[Optional[float]] = mapped_column(Float)

    # Summaries
    main_summary: Mapped[Optional[str]] = mapped_column(Text)
    linkedin_summary: Mapped[Optional[str]] = mapped_column(Text)
    linkedin_flag: Mapped[Optional[str]] = mapped_column(String(10))  # "green" | "red"

    # Structured JSON fields
    skills_matched: Mapped[Optional[dict]] = mapped_column(JSONB)      # list[str]
    skills_not_matched: Mapped[Optional[dict]] = mapped_column(JSONB)  # list[str]
    pros: Mapped[Optional[dict]] = mapped_column(JSONB)                # list[str]
    cons: Mapped[Optional[dict]] = mapped_column(JSONB)                # list[str]
    extracted_data: Mapped[Optional[dict]] = mapped_column(JSONB)      # raw parser output

    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    # pending | processing | completed | failed

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    recruiter: Mapped["Recruiter"] = relationship(back_populates="candidates")  # noqa: F821
    scoring_job: Mapped[Optional["ScoringJob"]] = relationship(back_populates="candidates")  # noqa: F821
