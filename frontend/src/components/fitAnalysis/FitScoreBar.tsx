import { ReactNode } from 'react'
import { getScoreColor, getScoreBgColor, getScoreLevel } from '../../types/fitAnalysis'

interface FitScoreBarProps {
  label: string
  score: number
  description?: string
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  icon?: ReactNode
}

export function FitScoreBar({
  label,
  score,
  description,
  size = 'md',
  showValue = true,
  icon,
}: FitScoreBarProps) {
  const level = getScoreLevel(score)
  const clampedScore = Math.max(0, Math.min(100, score))

  const heightClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  const valueClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-400">{icon}</span>}
          <span className={`font-medium text-gray-700 ${textClasses[size]}`}>
            {label}
          </span>
          {level === 'high' && (
            <span className="px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full">
              Strong
            </span>
          )}
        </div>
        {showValue && (
          <span className={`font-bold ${getScoreColor(score)} ${valueClasses[size]}`}>
            {clampedScore}%
          </span>
        )}
      </div>

      <div className={`w-full bg-gray-200 rounded-full ${heightClasses[size]}`}>
        <div
          className={`${heightClasses[size]} rounded-full transition-all duration-500 ${getScoreBgColor(score)}`}
          style={{ width: `${clampedScore}%` }}
        />
      </div>

      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  )
}
