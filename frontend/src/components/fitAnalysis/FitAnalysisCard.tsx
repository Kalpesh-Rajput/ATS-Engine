import { Target, Users, TrendingUp } from 'lucide-react'
import { Card } from '../common/Card'
import { FitScoreBar } from './FitScoreBar'
import { KeySignals } from './KeySignals'
import { StrengthsGaps } from './StrengthsGaps'
import { ReasoningExpandable } from './ReasoningExpandable'
import { FitAnalysisData } from '../../types/fitAnalysis'

interface FitAnalysisCardProps {
  fitData: FitAnalysisData
  className?: string
}

export function FitAnalysisCard({ fitData, className = '' }: FitAnalysisCardProps) {
  if (!fitData || !fitData.compatibility_assessment) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center py-8">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Fit analysis data not available</p>
        </div>
      </Card>
    )
  }

  const { compatibility_assessment, fit_reasoning, key_signals, strengths, gaps } = fitData

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Candidate Fit Assessment
            </h3>
            <p className="text-sm text-gray-500">
              AI-powered evaluation of candidate suitability
            </p>
          </div>
        </div>

        {/* Fit Scores */}
        <div className="space-y-5">
          <FitScoreBar
            label="Technical Suitability"
            score={compatibility_assessment.technical_suitability}
            description="Depth of relevant skills and technical experience"
            icon={<TrendingUp className="w-4 h-4" />}
            size="lg"
          />
          
          <FitScoreBar
            label="Workplace Alignment"
            score={compatibility_assessment.workplace_alignment}
            description="Soft skills, collaboration, and culture fit"
            icon={<Users className="w-4 h-4" />}
            size="lg"
          />
          
          <FitScoreBar
            label="Advancement Readiness"
            score={compatibility_assessment.advancement_readiness}
            description="Growth potential and learning trajectory"
            icon={<TrendingUp className="w-4 h-4" />}
            size="lg"
          />
        </div>

        {/* Key Signals */}
        {key_signals && key_signals.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <KeySignals signals={key_signals} />
          </div>
        )}

        {/* Strengths & Gaps */}
        <div className="pt-4 border-t border-gray-100">
          <StrengthsGaps strengths={strengths || []} gaps={gaps || []} />
        </div>

        {/* Reasoning (Expandable) */}
        {fit_reasoning && (
          <div className="pt-4 border-t border-gray-100">
            <ReasoningExpandable reasoning={fit_reasoning} />
          </div>
        )}

        {/* Debug Info (only shown if LLM failed) */}
        {fitData.fit_analysis_debug && !fitData.fit_analysis_debug.used_llm && (
          <div className="pt-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                <span className="font-medium">Note:</span> This analysis used fallback scoring due to LLM unavailability. Scores are derived from KPI metrics.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
