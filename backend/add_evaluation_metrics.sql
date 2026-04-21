-- Add KPI and Fit Analysis columns to candidates table
-- Run this manually in PostgreSQL if Alembic migration fails

-- KPI Evaluation fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS evaluation_breakdown JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kpi_validation JSONB;

-- Fit Analysis fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS compatibility_assessment JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fit_reasoning JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS key_signals JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS strengths JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS gaps JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fit_validation JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fit_analysis_debug JSONB;
