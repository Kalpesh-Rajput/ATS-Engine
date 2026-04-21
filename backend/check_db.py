"""Check if candidates table has new KPI and Fit fields."""
import asyncio
from sqlalchemy import text
from app.db.session import engine

async def check_fields():
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            SELECT evaluation_breakdown, compatibility_assessment, key_signals, strengths, gaps
            FROM candidates
            LIMIT 1
        """))
        row = result.fetchone()
        if row:
            print("✅ Candidate data found:")
            print(f"  evaluation_breakdown: {row[0]}")
            print(f"  compatibility_assessment: {row[1]}")
            print(f"  key_signals: {row[2]}")
            print(f"  strengths: {row[3]}")
            print(f"  gaps: {row[4]}")
        else:
            print("❌ No candidates found in database")

if __name__ == "__main__":
    asyncio.run(check_fields())
