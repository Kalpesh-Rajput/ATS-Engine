"""
Script to add KPI and Fit Analysis columns to candidates table.
Run this from the backend directory with: python add_columns.py
"""
import asyncio
from sqlalchemy import text
from app.db.session import engine


async def add_columns():
    """Add the new columns to the candidates table."""
    async with engine.begin() as conn:
        # KPI Evaluation fields
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS evaluation_breakdown JSONB"))
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kpi_validation JSONB"))
        
        # Fit Analysis fields
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS compatibility_assessment JSONB"))
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fit_reasoning JSONB"))
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS key_signals JSONB"))
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS strengths JSONB"))
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS gaps JSONB"))
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fit_validation JSONB"))
        await conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fit_analysis_debug JSONB"))
        
        print("✅ Successfully added all evaluation columns to candidates table")


if __name__ == "__main__":
    asyncio.run(add_columns())
