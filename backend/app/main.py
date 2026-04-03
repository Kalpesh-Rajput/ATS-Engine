from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.session import engine
from app.db.base import Base
from app.api.routes import auth, recruiters, jobs, candidates, uploads, health

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist (Alembic handles migrations in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="ATS — Applicant Tracking System",
    description="AI-powered ATS with multi-agent scoring pipeline",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static file serving (uploaded PDFs, dev only) ───────────────
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR, check_dir=False), name="uploads")

# ─── Routers ─────────────────────────────────────────────────────
app.include_router(health.router,      prefix="/api/v1",          tags=["Health"])
app.include_router(auth.router,        prefix="/api/v1/auth",     tags=["Auth"])
app.include_router(recruiters.router,  prefix="/api/v1/recruiters", tags=["Recruiters"])
app.include_router(uploads.router,     prefix="/api/v1/uploads",  tags=["Uploads"])
app.include_router(jobs.router,        prefix="/api/v1/jobs",     tags=["Jobs"])
app.include_router(candidates.router,  prefix="/api/v1/candidates", tags=["Candidates"])
