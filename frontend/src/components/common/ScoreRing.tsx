import { clsx } from 'clsx'

interface ScoreRingProps {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
}

const sizeConfig = {
  sm: { dimension: 40, stroke: 4, text: 'text-xs' },
  md: { dimension: 56, stroke: 5, text: 'text-sm' },
  lg: { dimension: 72, stroke: 6, text: 'text-lg' },
  xl: { dimension: 96, stroke: 8, text: 'text-xl' },
}

export function ScoreRing({ score, size = 'md', showLabel = true }: ScoreRingProps) {
  const config = sizeConfig[size]
  const normalizedScore = Math.min(100, Math.max(0, score || 0))

  const radius = (config.dimension - config.stroke) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (normalizedScore / 100) * circumference

  const getColor = (s: number) => {
    if (s >= 80) return { stroke: '#10b981', bg: 'text-success-50' }
    if (s >= 60) return { stroke: '#f59e0b', bg: 'text-warning-50' }
    if (s >= 40) return { stroke: '#f97316', bg: 'text-orange-50' }
    return { stroke: '#ef4444', bg: 'text-error-50' }
  }

  const colors = getColor(normalizedScore)

  return (
    <div className="flex items-center gap-3">
      <div
        className={clsx('relative rounded-full', colors.bg)}
        style={{ width: config.dimension, height: config.dimension }}
      >
        <svg
          width={config.dimension}
          height={config.dimension}
          className="rotate-[-90deg]"
        >
          {/* Background circle */}
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={config.stroke}
          />
          {/* Progress circle */}
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={clsx('font-bold text-gray-900', config.text)}>
              {Math.round(normalizedScore)}
            </span>
          </div>
        )}
      </div>
      {showLabel && (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-600">Score</span>
          <span
            className={clsx(
              'text-sm font-bold',
              normalizedScore >= 80 && 'text-success-600',
              normalizedScore >= 60 && normalizedScore < 80 && 'text-warning-600',
              normalizedScore < 60 && 'text-error-600'
            )}
          >
            {normalizedScore >= 80 && 'Excellent'}
            {normalizedScore >= 60 && normalizedScore < 80 && 'Good'}
            {normalizedScore >= 40 && normalizedScore < 60 && 'Average'}
            {normalizedScore < 40 && 'Needs Review'}
          </span>
        </div>
      )}
    </div>
  )
}
