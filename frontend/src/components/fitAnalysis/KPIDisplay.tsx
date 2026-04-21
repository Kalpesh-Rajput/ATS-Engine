import { Zap, Users, GraduationCap, Briefcase } from 'lucide-react'
import { EvaluationBreakdown, getScoreColor } from '../../types/fitAnalysis'

interface KPIDisplayProps {
  evaluationBreakdown: EvaluationBreakdown
  className?: string
}

interface KPIMetricProps {
  icon: React.ReactNode
  label: string
  score: number
  details: string
}

function KPIMetric({ icon, label, score, details }: KPIMetricProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="p-2 bg-white rounded-lg shadow-sm">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-bold ${getScoreColor(score)}`}>
            {score}%
          </span>
        </div>
        <p className="text-xs text-gray-500">{details}</p>
      </div>
    </div>
  )
}

export function KPIDisplay({ evaluationBreakdown, className = '' }: KPIDisplayProps) {
  if (!evaluationBreakdown) {
    return null
  }

  const { technology_stack, core_strengths, education, experience } = evaluationBreakdown

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
        Evaluation Metrics
      </h4>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KPIMetric
          icon={<Zap className="w-4 h-4 text-amber-500" />}
          label="Technology Stack"
          score={technology_stack?.score ?? 0}
          details={`${technology_stack?.skills_matched_count ?? 0}/${technology_stack?.total_jd_skills ?? 0} skills matched`}
        />
        
        <KPIMetric
          icon={<Users className="w-4 h-4 text-blue-500" />}
          label="Core Strengths"
          score={core_strengths?.score ?? 0}
          details={`${core_strengths?.matched_count ?? 0}/${core_strengths?.total_categories ?? 6} soft skill categories`}
        />
        
        <KPIMetric
          icon={<GraduationCap className="w-4 h-4 text-purple-500" />}
          label="Education"
          score={education?.score ?? 0}
          details={`${education?.entry_count ?? 0} credential${(education?.entry_count ?? 0) === 1 ? '' : 's'}`}
        />
        
        <KPIMetric
          icon={<Briefcase className="w-4 h-4 text-emerald-500" />}
          label="Experience"
          score={experience?.score ?? 0}
          details={`${experience?.role_count ?? 0} role${(experience?.role_count ?? 0) === 1 ? '' : 's'}`}
        />
      </div>
    </div>
  )
}
