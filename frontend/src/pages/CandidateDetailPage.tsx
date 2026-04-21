import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
  ArrowLeft,
  CheckCircle,
  Flag,
  Mail,
  MapPin,
  Phone,
  Star,
  ThumbsUp,
  ThumbsDown,
  Download,
  Calendar,
  Briefcase,
  Award,
  Sparkles,
  Target,
  Shield,
  Zap,
  Users,
} from 'lucide-react'
import { candidateService } from '../services/apiServices'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'

// Professional score ring component
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (score / 100) * circumference
  
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'from-emerald-500 to-emerald-600'
    if (s >= 60) return 'from-amber-500 to-amber-600'
    return 'from-rose-500 to-rose-600'
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={45}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-gray-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={45}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`bg-gradient-to-br ${getScoreColor(score)}`}
          style={{
            stroke: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e'
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">{score}</span>
        <span className="text-xs text-gray-500">Score</span>
      </div>
    </div>
  )
}

// Enhanced skill tag with gradient
function SkillTag({ label, matched }: { label: string; matched: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
        matched
          ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200'
          : 'bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 border border-rose-200'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          matched ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />
      {label}
    </span>
  )
}

// Info card component
function InfoCard({
  icon: Icon,
  label,
  value,
  color = 'from-primary-500 to-primary-600',
}: {
  icon: React.ElementType
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all duration-300">
      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-md`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

// Section card with enhanced styling
function SectionCard({
  title,
  icon: Icon,
  children,
  color = 'from-primary-500 to-primary-600',
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  color?: string
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} p-2 text-white shadow-md`}
        >
          <Icon className="w-full h-full" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </Card>
  )
}

export default function CandidateDetailPage() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const exportToPDF = async () => {
  const element = document.getElementById('candidate-profile')
  if (!element) {
    toast.error('Unable to export profile')
    return
  }

  try {
    toast.loading('Generating PDF...', { id: 'pdf-export' })

    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 12
    const contentWidth = pageWidth - margin * 2
    const contentHeightPx = pageHeight - margin * 2

    // Scale factor: how many PDF mm per screen pixel
    const scale = 2
    const pxToMm = contentWidth / (element.scrollWidth * scale)

    // Render the entire profile at once at 2x scale
    const fullCanvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    })

    const totalHeightMM = (fullCanvas.height * contentWidth) / fullCanvas.width
    const pageHeightPx = Math.floor((pageHeight - margin * 2) * fullCanvas.width / contentWidth)

    // Find all Card boundaries relative to the profile container
    const containerTop = element.getBoundingClientRect().top + window.scrollY
    const cards = Array.from(element.querySelectorAll<HTMLElement>('[class*="rounded"]'))
      .filter(el => {
        // Only pick top-level meaningful blocks (cards with enough height)
        const rect = el.getBoundingClientRect()
        return rect.height > 60
      })

    // Get the y positions (in canvas pixels) where we MUST NOT cut
    // i.e., between top and bottom of each card
    const forbiddenRanges: Array<{ top: number; bottom: number }> = []

    cards.forEach(card => {
      const rect = card.getBoundingClientRect()
      const topPx = (rect.top + window.scrollY - containerTop) * scale
      const bottomPx = (rect.bottom + window.scrollY - containerTop) * scale
      forbiddenRanges.push({ top: topPx, bottom: bottomPx })
    })

    // Find safe cut points — prefer cutting BETWEEN cards
    const findSafeCutPoint = (idealCutPx: number): number => {
      // Check if ideal cut falls inside a card
      const conflicting = forbiddenRanges.find(
        r => idealCutPx > r.top + 20 && idealCutPx < r.bottom - 20
      )
      if (!conflicting) return idealCutPx
      // Cut just before this card starts
      return conflicting.top - 10
    }

    // Slice canvas into pages at safe cut points
    let renderedPx = 0
    let pageNum = 0

    while (renderedPx < fullCanvas.height) {
      if (pageNum > 0) pdf.addPage()

      const idealEnd = renderedPx + pageHeightPx
      const safeCut = idealEnd >= fullCanvas.height
        ? fullCanvas.height
        : findSafeCutPoint(idealEnd)

      const sliceHeight = Math.max(safeCut - renderedPx, 1)

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = fullCanvas.width
      pageCanvas.height = sliceHeight

      const ctx = pageCanvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageCanvas.width, sliceHeight)
      ctx.drawImage(fullCanvas, 0, renderedPx, fullCanvas.width, sliceHeight, 0, 0, fullCanvas.width, sliceHeight)

      const sliceHeightMM = (sliceHeight * contentWidth) / fullCanvas.width
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, sliceHeightMM)

      renderedPx += sliceHeight
      pageNum++
    }

    const fileName = `${candidate?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Candidate'}_Profile_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)
    toast.success('Profile exported successfully!', { id: 'pdf-export' })
  } catch (error) {
    console.error('PDF export error:', error)
    toast.error('Failed to export profile', { id: 'pdf-export' })
  }
  }

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => candidateService.getCandidate(candidateId!),
    enabled: !!candidateId,
    retry: false,
  })

  const reviewStatusMutation = useMutation({
    mutationFn: ({ review_status }: { review_status: string }) =>
      candidateService.updateReviewStatus(candidateId!, review_status),
    onSuccess: (_, { review_status }) => {
      toast.success(`Status updated to ${review_status.replace('_', ' ')}`)
      qc.invalidateQueries({ queryKey: ['candidate', candidateId] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
      qc.invalidateQueries({ queryKey: ['recruiter-stats'] })
    },
    onError: () => toast.error('Failed to update candidate status'),
  })

  const statusOptions = [
    { value: 'in_process', label: 'In Process' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'not_shortlisted', label: 'Not Shortlisted' },
    { value: 'selected', label: 'Selected' },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading candidate profile...</p>
        </div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <Card className="text-center p-12 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Candidate not found</h3>
          <p className="text-gray-500 mb-6">The candidate profile you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate(-1)} variant="primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </Card>
      </div>
    )
  }

  const isShortlisted = candidate.review_status === 'shortlisted'
  const matchScore = candidate.linkedin_match_score || 0
  const atsScore = candidate.ats_score || 0
  const selectedStatus = candidate.review_status === 'in_process' ? '' : candidate.review_status ?? ''
  const clientName = candidate.client_name || 'Unknown Client'
  
  // Check for duplicate status
  const duplicateStatus = candidate.extracted_data?.duplicate_status
  const duplicateReason = candidate.extracted_data?.duplicate_reason

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200/80 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {candidate.name || 'Unknown Candidate'}
              </h1>
              <p className="text-sm text-gray-500">{candidate.job_applied}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={exportToPDF}>
              <Download className="w-4 h-4 mr-2" />
              Export Profile
            </Button>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) =>
                  reviewStatusMutation.mutate({ review_status: e.target.value })
                }
                disabled={reviewStatusMutation.isPending}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all disabled:opacity-50"
              >
                <option value="" disabled>
                  Choose Status
                </option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div id="candidate-profile" className="max-w-7xl mx-auto p-8 space-y-8 bg-white">
        {/* PDF Header - Candidate Info */}
        <div className="mb-8 pb-6 border-b-2 border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {candidate.name || 'Unknown Candidate'}
          </h1>
          <div className="flex flex-wrap items-center gap-6">
            <p className="text-lg text-primary-600 font-semibold">
              Position: {candidate.job_applied || 'Not specified'}
            </p>
            <p className="text-base text-gray-600">
              Applied: {new Date(candidate.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <p className="text-base text-gray-600">
              Client: {clientName}
            </p>
          </div>
        </div>

        {/* Top Section - Score & Quick Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Score Card */}
          <Card className="p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500 via-violet-500 to-emerald-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-100 to-transparent rounded-full -mr-16 -mt-16 opacity-50" />
            
            <div className="relative mb-6">
              <ScoreRing score={atsScore} size={140} />
              {isShortlisted && (
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-lg">
                  <Star className="w-4 h-4" />
                </div>
              )}
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">ATS Score</h2>
            <p className="text-sm text-gray-500 mb-4">
              {atsScore >= 80
                ? 'Excellent match for this role'
                : atsScore >= 60
                ? 'Good fit with potential'
                : 'May need further review'}
            </p>
            
            {/* LinkedIn Verification Badge */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                candidate.linkedin_flag === 'green'
                  ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border border-amber-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              LinkedIn {candidate.linkedin_flag === 'green' ? 'Verified' : 'Mismatch'}
            </div>
            
            {/* Duplicate Status Badge */}
            {duplicateStatus && (
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mt-2 ${
                  duplicateStatus === 'blacklisted'
                    ? 'bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 border border-rose-200'
                    : duplicateStatus === 'existing'
                    ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                <Flag className="w-4 h-4" />
                {duplicateStatus === 'blacklisted' && 'Blacklisted'}
                {duplicateStatus === 'existing' && 'Previously Processed'}
                {duplicateReason && (
                  <span className="text-xs opacity-75">- {duplicateReason}</span>
                )}
              </div>
            )}
          </Card>

          {/* Quick Info Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoCard
                icon={Mail}
                label="Email"
                value={candidate.email || 'Not provided'}
                color="from-blue-500 to-blue-600"
              />
              <InfoCard
                icon={Phone}
                label="Phone"
                value={candidate.phone || 'Not provided'}
                color="from-violet-500 to-violet-600"
              />
              <InfoCard
                icon={MapPin}
                label="Location"
                value={candidate.location || 'Not specified'}
                color="from-emerald-500 to-emerald-600"
              />
              <InfoCard
                icon={Calendar}
                label="Applied"
                value={new Date(candidate.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                color="from-amber-500 to-amber-600"
              />
            </div>

            {/* LinkedIn Match Score */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">LinkedIn Consistency</h3>
                    <p className="text-sm text-gray-500">Profile verification score</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-gray-900">{Math.round(matchScore)}%</span>
              </div>
              
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    matchScore >= 80
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : matchScore >= 60
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                      : 'bg-gradient-to-r from-rose-500 to-rose-400'
                  }`}
                  style={{ width: `${matchScore}%` }}
                />
              </div>
              
              <p className="text-sm text-gray-600 mt-4 leading-relaxed">
                {candidate.linkedin_summary ||
                  'No LinkedIn analysis available. Upload LinkedIn profile for verification.'}
              </p>
            </Card>
          </div>
        </div>

        {/* KPI Metrics - Evaluation Breakdown */}
        {candidate.evaluation_breakdown && (
          <SectionCard
            title="Evaluation Breakdown"
            icon={Target}
            color="from-blue-500 to-cyan-600"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <p className="text-xs text-blue-600 font-semibold mb-1">Technology Stack</p>
                <p className="text-3xl font-bold text-blue-900">
                  {candidate.evaluation_breakdown.technology_stack?.score || 0}%
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <p className="text-xs text-purple-600 font-semibold mb-1">Core Strengths</p>
                <p className="text-3xl font-bold text-purple-900">
                  {candidate.evaluation_breakdown.core_strengths?.score || 0}%
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                <p className="text-xs text-emerald-600 font-semibold mb-1">Education</p>
                <p className="text-3xl font-bold text-emerald-900">
                  {candidate.evaluation_breakdown.education?.score || 0}%
                </p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
                <p className="text-xs text-amber-600 font-semibold mb-1">Experience</p>
                <p className="text-3xl font-bold text-amber-900">
                  {candidate.evaluation_breakdown.experience?.score || 0}%
                </p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Fit Analysis - Compatibility Assessment */}
        {candidate.compatibility_assessment && (
          <SectionCard
            title="Compatibility Assessment"
            icon={Users}
            color="from-violet-500 to-purple-600"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border-2 border-violet-200 bg-violet-50 hover:border-violet-300 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Technical Suitability</span>
                  <span className="text-lg font-bold text-violet-600">
                    {Math.round(candidate.compatibility_assessment.technical_suitability || 0)}%
                  </span>
                </div>
                <div className="h-3 bg-violet-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
                    style={{ width: `${Math.round(candidate.compatibility_assessment.technical_suitability || 0)}%` }}
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-300 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Workplace Alignment</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {Math.round(candidate.compatibility_assessment.workplace_alignment || 0)}%
                  </span>
                </div>
                <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                    style={{ width: `${Math.round(candidate.compatibility_assessment.workplace_alignment || 0)}%` }}
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:border-purple-300 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Advancement Readiness</span>
                  <span className="text-lg font-bold text-purple-600">
                    {Math.round(candidate.compatibility_assessment.advancement_readiness || 0)}%
                  </span>
                </div>
                <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500"
                    style={{ width: `${Math.round(candidate.compatibility_assessment.advancement_readiness || 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ATS Summary */}
          <SectionCard
            title="AI Analysis Summary"
            icon={Sparkles}
            color="from-violet-500 to-purple-600"
          >
            <p className="text-gray-600 leading-relaxed">
              {candidate.main_summary || 'No summary generated.'}
            </p>
          </SectionCard>

          {/* Skills */}
          <SectionCard title="Skills Analysis" icon={Target} color="from-blue-500 to-cyan-600">
            {/* Matched Skills */}
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Matched Skills
              </h4>
              <div className="flex flex-wrap gap-2">
                {(candidate.skills_matched?.length || 0) > 0 ? (
                  candidate.skills_matched.map((skill: string) => (
                    <SkillTag key={skill} label={skill} matched={true} />
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No matched skills found</p>
                )}
              </div>
            </div>

            {/* Missing Skills */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-500" />
                Skills Gap
              </h4>
              <div className="flex flex-wrap gap-2">
                {(candidate.skills_not_matched?.length || 0) > 0 ? (
                  candidate.skills_not_matched.map((skill: string) => (
                    <SkillTag key={skill} label={skill} matched={false} />
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No significant skill gaps</p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Pros */}
          <SectionCard
            title="Strengths & Highlights"
            icon={ThumbsUp}
            color="from-emerald-500 to-teal-600"
          >
            {(candidate.pros?.length || 0) > 0 ? (
              <ul className="space-y-3">
                {candidate.pros.map((pro: string, index: number) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50/50 to-transparent border border-emerald-100/50"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-gray-700">{pro}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Award className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400">No specific strengths highlighted</p>
              </div>
            )}
          </SectionCard>

          {/* Cons */}
          <SectionCard title="Areas for Review" icon={ThumbsDown} color="from-rose-500 to-pink-600">
            {(candidate.cons?.length || 0) > 0 ? (
              <ul className="space-y-3">
                {candidate.cons.map((con: string, index: number) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-rose-50/50 to-transparent border border-rose-100/50"
                  >
                    <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Flag className="w-3.5 h-3.5 text-rose-600" />
                    </div>
                    <span className="text-gray-700">{con}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400">No significant concerns identified</p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Action Bar */}
        <Card className="p-6 flex items-center justify-between bg-gradient-to-r from-primary-50 to-violet-50 border-primary-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Update Candidate Status</h3>
              <p className="text-sm text-gray-600">Change the review status to organize your hiring pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Back to List
            </Button>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Status</label>
              <select
                value={selectedStatus}
                onChange={(e) =>
                  reviewStatusMutation.mutate({ review_status: e.target.value })
                }
                disabled={reviewStatusMutation.isPending}
                className="px-4 py-2.5 rounded-xl border-2 border-primary-300 bg-white text-sm font-semibold text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all disabled:opacity-50"
              >
                <option value="" disabled>
                  Choose Status
                </option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
