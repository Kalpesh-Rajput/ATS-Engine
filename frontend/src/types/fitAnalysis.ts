/**
 * Types for Hybrid Evaluation System (KPI + Fit Analysis)
 */

// ─── KPI Evaluation Types ─────────────────────────────────────────

export interface TechnologyStackKPI {
  score: number;              // 0-100
  skills_matched_count: number;
  total_jd_skills: number;
}

export interface CoreStrengthsKPI {
  score: number;              // 0-100
  categories_detected: string[];
  categories_missed: string[];
  matched_count: number;
  total_categories: number;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year?: string;
}

export interface EducationKPI {
  score: number;              // 0-100
  entry_count: number;
  entries: EducationEntry[];
}

export interface ExperienceRole {
  title: string;
  company: string;
  duration?: string;
}

export interface ExperienceKPI {
  score: number;              // 0-100
  role_count: number;
  roles: ExperienceRole[];
}

export interface EvaluationBreakdown {
  technology_stack: TechnologyStackKPI;
  core_strengths: CoreStrengthsKPI;
  education: EducationKPI;
  experience: ExperienceKPI;
  key_signals: string[];
}

// ─── Fit Analysis Types ───────────────────────────────────────────

export interface CompatibilityAssessment {
  technical_suitability: number;    // 0-100
  workplace_alignment: number;       // 0-100
  advancement_readiness: number;   // 0-100
}

export interface FitReasoning {
  technical: string;
  workplace: string;
  advancement: string;
}

export interface FitValidation {
  valid: boolean;
  range_checks: {
    technical_suitability?: boolean;
    workplace_alignment?: boolean;
    advancement_readiness?: boolean;
  };
  cross_check_issues: string[];
  reasoning_valid: boolean;
  strengths_gaps_valid: boolean;
}

export interface FitAnalysisDebug {
  used_llm: boolean;
  fallback_reason?: string;
  input_summary?: {
    tech_score: number;
    core_score: number;
    edu_score: number;
    exp_score: number;
  };
}

export interface FitAnalysisData {
  compatibility_assessment: CompatibilityAssessment;
  fit_reasoning: FitReasoning;
  key_signals: string[];
  strengths: string[];
  gaps: string[];
  fit_validation?: FitValidation;
  fit_analysis_debug?: FitAnalysisDebug;
}

// ─── Soft Skill Categories ────────────────────────────────────────

export const SOFT_SKILL_CATEGORIES = {
  leadership: 'Leadership',
  collaboration: 'Collaboration',
  communication: 'Communication',
  problem_solving: 'Problem Solving',
  ownership: 'Ownership',
  adaptability: 'Adaptability',
} as const;

export type SoftSkillCategory = keyof typeof SOFT_SKILL_CATEGORIES;

// ─── Score Interpretation Helpers ─────────────────────────────────

export function getScoreLevel(score: number): 'high' | 'moderate' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'moderate';
  return 'low';
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-rose-600';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

export function getScoreGradient(score: number): string {
  if (score >= 80) return 'from-emerald-500 to-emerald-600';
  if (score >= 60) return 'from-amber-500 to-amber-600';
  return 'from-rose-500 to-rose-600';
}
