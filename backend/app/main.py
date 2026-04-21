from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.session import engine
from app.db.base import Base
from app.api.routes import auth, recruiters, jobs, candidates, uploads, health

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: run alembic migrations to ensure database schema is up to date
    import os
    import sys
    
    # Change to the backend directory to ensure alembic.ini is found
    original_dir = os.getcwd()
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    try:
        from alembic.config import Config
        from alembic import command
        
        alembic_cfg = Config("alembic.ini")
        # Set the script location explicitly
        alembic_cfg.set_main_option("script_location", "alembic")
        
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations applied successfully")
    except Exception as e:
        logger.error(f"Failed to run alembic migrations: {e}")
        logger.warning("Please run 'alembic upgrade head' manually to update the database schema")
        # Fallback: create tables if they don't exist
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Created tables from model definitions (fallback)")
        except Exception as create_error:
            logger.error(f"Failed to create tables: {create_error}")
            logger.error("DATABASE SCHEMA IS OUT OF SYNC. Please run: alembic upgrade head")
    finally:
        # Restore original directory
        os.chdir(original_dir)
    
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
