from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "ats_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.services.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=86400,  # 24 hours
    beat_schedule={
        "reset-stuck-scoring-jobs-every-5-min": {
            "task": "app.services.tasks.reset_stuck_scoring_jobs",
            "schedule": crontab(minute="*/5"),
        }
    },
)
