"""Celery tasks that bridge the async agent pipeline to the sync worker."""
import asyncio
from datetime import datetime, timezone
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

from celery import shared_task
from sqlalchemy import create_engine, text, select, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.core.celery_app import celery_app

# Sync engine for Celery workers (asyncpg not supported in sync context)
_sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)


def _get_sync_session() -> Session:
    return Session(bind=_sync_engine)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def run_scoring_pipeline(
    self,
    job_id: str,
    recruiter_id: str,
    jd_path: str,
    job_title: str,
    candidates: List[dict],
):
    """
    Celery task that runs the full LangGraph multi-agent scoring pipeline
    for every candidate in the job.
    """
    with _get_sync_session() as db:
        try:
            # Import inside the task process. If this fails, we still update the job row
            # so it doesn't remain stuck in `pending` forever.
            from app.models.scoring_job import ScoringJob
            from app.models.candidate import Candidate
        except Exception as exc:
            db.execute(
                text(
                    """
                    UPDATE scoring_jobs
                    SET status = 'failed',
                        processed_candidates = COALESCE(total_candidates, 0),
                        failed_candidates = COALESCE(total_candidates, 0),
                        error_message = :err,
                        completed_at = NOW()
                    WHERE id = :job_id
                    """
                ),
                {"err": str(exc), "job_id": job_id},
            )
            db.commit()
            logger.error("scoring_job_import_failed", job_id=job_id, error=str(exc))
            return

        job = db.get(ScoringJob, job_id)
        if not job:
            logger.error("scoring_job_not_found", job_id=job_id)
            return

        # Import inside the worker (after model import/registry is ready).
        from app.agents.pipeline import run_pipeline_sync
        from app.agents.parser_agent import normalize_skills
        from app.agents.prompts.templates import JD_PARSER_PROMPT, JD_PARSER_SYSTEM
        from app.agents.tools.llm_client import llm_call_json
        from app.services.embedding_service import embed_document
        from app.services.pdf_parser import extract_text_from_pdf
        from app.services.vector_store import begin_batch_upserts, flush_batch_upserts

        job.status = "processing"
        db.commit()

        job_uuid = uuid.UUID(job_id)
        completed_before = (
            db.scalar(
                select(func.count())
                .select_from(Candidate)
                .where(
                    Candidate.scoring_job_id == job_uuid,
                    Candidate.status == "completed",
                )
            )
            or 0
        )
        failed_before = (
            db.scalar(
                select(func.count())
                .select_from(Candidate)
                .where(
                    Candidate.scoring_job_id == job_uuid,
                    Candidate.status == "failed",
                )
            )
            or 0
        )
        processed = int(completed_before)
        failed = int(failed_before)
        job.processed_candidates = processed
        job.failed_candidates = failed

        try:
            # Reuse parsed/embedded JD cached in `scoring_jobs.meta`
            # so multiple candidate batches in the same session don't re-run JD work.
            meta = job.meta or {}
            jd_text = job.jd_text or meta.get("jd_text") or ""
            jd_required_skills: list[str] = meta.get("jd_required_skills") or []
            jd_preferred_skills: list[str] = meta.get("jd_preferred_skills") or []
            jd_embedding = meta.get("jd_embedding") or None
            changed_meta = False

            if not jd_text.strip():
                jd_text = extract_text_from_pdf(jd_path) or ""
                job.jd_text = jd_text
                changed_meta = True

            # Parse JD required/preferred skills once per session/job.
            if (not jd_required_skills and not jd_preferred_skills) and jd_text.strip():
                try:
                    jd_data = llm_call_json(
                        JD_PARSER_SYSTEM,
                        JD_PARSER_PROMPT.format(jd_text=jd_text[:3000]),
                    )
                    jd_required_skills = normalize_skills(jd_data.get("required_skills", []))
                    jd_preferred_skills = normalize_skills(jd_data.get("preferred_skills", []))
                    meta["jd_required_skills"] = jd_required_skills
                    meta["jd_preferred_skills"] = jd_preferred_skills
                    changed_meta = True
                except Exception as exc:
                    logger.warning("jd_parse_failed_once", job_id=job_id, error=str(exc))

            # Embed JD once per session/job.
            if jd_embedding is None and jd_text.strip():
                try:
                    jd_embedding = embed_document(jd_text)
                    meta["jd_embedding"] = jd_embedding
                    changed_meta = True
                except Exception as exc:
                    logger.warning("jd_embedding_failed_once", job_id=job_id, error=str(exc))

            if changed_meta:
                job.meta = meta
                db.commit()

            # Mark candidates as processing up-front.
            candidate_rows = []
            for cand_payload in candidates:
                candidate_id = cand_payload["candidate_id"]
                resume_path = cand_payload["resume_path"]
                linkedin_path = cand_payload["linkedin_path"]
                candidate = db.get(Candidate, candidate_id)
                if not candidate:
                    failed += 1
                    continue

                candidate.status = "processing"
                candidate_rows.append((candidate, resume_path, linkedin_path))

            db.commit()

            # Process candidates concurrently (important on Windows Celery `--pool=solo`).
            # Batch FAISS upserts so we don't write the full index to disk per candidate.
            begin_batch_upserts()
            try:
                max_workers = max(1, int(getattr(settings, "CANDIDATE_PIPELINE_WORKERS", 4)))
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = {}
                    for (candidate, resume_path, linkedin_path) in candidate_rows:
                        fut = executor.submit(
                            run_pipeline_sync,
                            jd_path,
                            resume_path,
                            linkedin_path,
                            job_title,
                            recruiter_id,
                            str(candidate.id),
                            job_id,
                            jd_text,
                            jd_required_skills,
                            jd_preferred_skills,
                            jd_embedding,
                        )
                        futures[fut] = candidate

                    for fut in as_completed(futures):
                        candidate = futures[fut]
                        try:
                            state = fut.result()
                            guardrails = (state.get("extracted_data") or {}).get("guardrails") or {}
                            output_blocked = bool(
                                state.get("output_blocked")
                                or guardrails.get("output_blocked")
                            )

                            if output_blocked:
                                candidate.extracted_data = state.get("extracted_data", {})
                                candidate.status = "failed"
                                failed += 1
                                job.processed_candidates = processed
                                job.failed_candidates = failed
                                db.commit()
                                continue

                            # Persist agent output to candidate record (UI reads these fields)
                            candidate.name = state.get("name")
                            candidate.email = state.get("email")
                            candidate.phone = state.get("phone")
                            candidate.location = state.get("location")

                            candidate.ats_score = state.get("ats_score")
                            candidate.linkedin_match_score = state.get("linkedin_match_score")
                            candidate.main_summary = state.get("main_summary")
                            candidate.linkedin_summary = state.get("linkedin_summary")
                            candidate.linkedin_flag = state.get("linkedin_flag")

                            candidate.skills_matched = state.get("skills_matched", [])
                            candidate.skills_not_matched = state.get("skills_not_matched", [])
                            candidate.pros = state.get("pros", [])
                            candidate.cons = state.get("cons", [])
                            candidate.extracted_data = state.get("extracted_data", {})
                            candidate.status = "completed"
                            processed += 1
                        except Exception as exc:
                            logger.error(
                                "candidate_processing_failed",
                                candidate_id=str(candidate.id),
                                error=str(exc),
                            )
                            candidate.status = "failed"
                            failed += 1

                        job.processed_candidates = processed
                        job.failed_candidates = failed
                        db.commit()
            finally:
                flush_batch_upserts()

            # Finalise job based on ALL candidates in the session (supports
            # appending candidates in multiple batches).
            completed_after = (
                db.scalar(
                    select(func.count())
                    .select_from(Candidate)
                    .where(
                        Candidate.scoring_job_id == job_uuid,
                        Candidate.status == "completed",
                    )
                )
                or 0
            )
            failed_after = (
                db.scalar(
                    select(func.count())
                    .select_from(Candidate)
                    .where(
                        Candidate.scoring_job_id == job_uuid,
                        Candidate.status == "failed",
                    )
                )
                or 0
            )
            job.processed_candidates = int(completed_after)
            job.failed_candidates = int(failed_after)

            total = int(job.total_candidates or 0)
            all_done = (int(completed_after) + int(failed_after)) >= total and total > 0
            if not all_done:
                job.status = "processing"
                job.completed_at = None
            else:
                if failed_after == 0:
                    job.status = "completed"
                elif completed_after > 0:
                    job.status = "partial"
                else:
                    job.status = "failed"
                job.completed_at = datetime.now(timezone.utc)
            db.commit()

            logger.info(
                "scoring_job_finished",
                job_id=job_id,
                processed=processed,
                failed=failed,
                status=job.status,
            )
        except Exception as exc:
            # Catch any unexpected failure to avoid leaving the job in `pending`.
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.error("scoring_job_failed_unexpected", job_id=job_id, error=str(exc))
            return
