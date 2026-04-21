import { Zap, CheckCircle, AlertCircle, TrendingUp, Award, Briefcase, GraduationCap } from 'lucide-react'

interface KeySignalsProps {
  signals: string[]
}

function getSignalIcon(signal: string) {
  const lowerSignal = signal.toLowerCase()
  
  if (lowerSignal.includes('tech') || lowerSignal.includes('skill')) {
    return <Zap className="w-4 h-4 text-amber-500" />
  }
  if (lowerSignal.includes('soft skill') || lowerSignal.includes('profile')) {
    return <CheckCircle className="w-4 h-4 text-emerald-500" />
  }
  if (lowerSignal.includes('role') || lowerSignal.includes('experience')) {
    return <Briefcase className="w-4 h-4 text-blue-500" />
  }
  if (lowerSignal.includes('education') || lowerSignal.includes('credential')) {
    return <GraduationCap className="w-4 h-4 text-purple-500" />
  }
  if (lowerSignal.includes('advancement') || lowerSignal.includes('growth')) {
    return <TrendingUp className="w-4 h-4 text-emerald-500" />
  }
  if (lowerSignal.includes('suitability') || lowerSignal.includes('alignment')) {
    return <Award className="w-4 h-4 text-indigo-500" />
  }
  if (lowerSignal.includes('gap') || lowerSignal.includes('limited')) {
    return <AlertCircle className="w-4 h-4 text-rose-500" />
  }
  
  return <Zap className="w-4 h-4 text-gray-400" />
}

function getSignalStyle(signal: string): string {
  const lowerSignal = signal.toLowerCase()
  
  // Positive signals
  if (lowerSignal.includes('strong') || lowerSignal.includes('high')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (lowerSignal.includes('moderate') || lowerSignal.includes('solid')) {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  if (lowerSignal.includes('well-balanced')) {
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }
  
  // Caution signals
  if (lowerSignal.includes('limited') || lowerSignal.includes('low') || lowerSignal.includes('gap')) {
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }
  
  // Neutral/default
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

export function KeySignals({ signals }: KeySignalsProps) {
  if (!signals || signals.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
        Key Signals
      </h4>
      <div className="flex flex-wrap gap-2">
        {signals.map((signal, index) => (
          <div
            key={index}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${getSignalStyle(signal)}`}
          >
            {getSignalIcon(signal)}
            <span>{signal}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
