import { useState } from 'react'
import { ChevronDown, ChevronUp, Brain } from 'lucide-react'
import { FitReasoning } from '../../types/fitAnalysis'

interface ReasoningExpandableProps {
  reasoning: FitReasoning
}

export function ReasoningExpandable({ reasoning }: ReasoningExpandableProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!reasoning) {
    return null
  }

  const sections = [
    { key: 'technical', label: 'Technical', content: reasoning.technical },
    { key: 'workplace', label: 'Workplace', content: reasoning.workplace },
    { key: 'advancement', label: 'Advancement', content: reasoning.advancement },
  ]

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-700">
            AI Reasoning
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 bg-white">
          {sections.map((section) => (
            <div key={section.key} className="space-y-1">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.label}
              </h5>
              <p className="text-sm text-gray-700 leading-relaxed">
                {section.content || 'No reasoning provided'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
