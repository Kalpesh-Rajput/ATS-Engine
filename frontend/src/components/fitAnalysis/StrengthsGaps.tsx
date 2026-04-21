import { CheckCircle2, XCircle } from 'lucide-react'

interface StrengthsGapsProps {
  strengths: string[]
  gaps: string[]
}

export function StrengthsGaps({ strengths, gaps }: StrengthsGapsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Strengths */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Strengths
          </h4>
        </div>
        <ul className="space-y-2">
          {strengths && strengths.length > 0 ? (
            strengths.map((strength, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                {strength}
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-500 italic">
              No specific strengths identified
            </li>
          )}
        </ul>
      </div>

      {/* Gaps */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-rose-500" />
          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Gaps
          </h4>
        </div>
        <ul className="space-y-2">
          {gaps && gaps.length > 0 ? (
            gaps.map((gap, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                {gap}
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-500 italic">
              No significant gaps identified
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
