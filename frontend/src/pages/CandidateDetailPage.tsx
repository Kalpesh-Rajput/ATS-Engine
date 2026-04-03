import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CheckCircle, Flag, Mail, MapPin,
  Phone, Star, ThumbsDown, ThumbsUp, User,
} from 'lucide-react'
import { candidateService } from '../services/apiServices'
import ScoreRing from '../components/candidates/ScoreRing'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 space-y-3">
      <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

function SkillTag({ label, matched }: { label: string; matched: boolean }) {
  return (
    <span className={matched ? 'badge-green' : 'badge-red'}>
      {matched ? '✓' : '✗'} {label}
    </span>
  )
}

export default function CandidateDetailPage() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: c, isLoading } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => candidateService.getCandidate(candidateId!),
  })

  const shortlistMutation = useMutation({
    mutationFn: () => candidateService.shortlist([candidateId!]),
    onSuccess: () => {
      toast.success('Candidate shortlisted!')
      qc.invalidateQueries({ queryKey: ['candidate', candidateId] })
      qc.invalidateQueries({ queryKey: ['recruiter-stats'] })
    },
    onError: () => toast.error('Failed to shortlist candidate'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-slate-400">
        Loading candidate profile…
      </div>
    )
  }

  if (!c) {
    return (
      <div className="p-8 text-center text-slate-500">
        Candidate not found.
        <button className="btn-secondary mt-4 block mx-auto" onClick={() => navigate(-1)}>Go back</button>
      </div>
    )
  }

  const isShortlisted = c.status === 'shortlisted'

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2 mt-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">{c.name ?? 'Unknown Candidate'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{c.job_applied}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {c.email && <span className="flex items-center gap-1 text-xs text-slate-500"><Mail className="w-3.5 h-3.5" />{c.email}</span>}
            {c.phone && <span className="flex items-center gap-1 text-xs text-slate-500"><Phone className="w-3.5 h-3.5" />{c.phone}</span>}
            {c.location && <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="w-3.5 h-3.5" />{c.location}</span>}
          </div>
        </div>

        {/* Score + actions */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="flex items-center gap-4">
            <ScoreRing score={c.ats_score ?? 0} size={72} />
            <div>
              <p className="text-xs text-slate-500 mb-1">ATS Score</p>
              <span
                className={
                  c.linkedin_flag === 'green' ? 'badge-green text-sm' : 'badge-red text-sm'
                }
              >
                <Flag className="w-3.5 h-3.5" />
                LinkedIn {c.linkedin_flag === 'green' ? 'Green Flag' : 'Red Flag'}
              </span>
            </div>
          </div>
          <button
            className={isShortlisted ? 'btn-secondary' : 'btn-primary'}
            onClick={() => !isShortlisted && shortlistMutation.mutate()}
            disabled={isShortlisted || shortlistMutation.isPending}
          >
            <CheckCircle className="w-4 h-4" />
            {isShortlisted ? 'Shortlisted' : 'Shortlist'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ATS Summary */}
        <Section title="ATS Summary">
          <p className="text-sm text-slate-600 leading-relaxed">
            {c.main_summary ?? 'No summary generated.'}
          </p>
        </Section>

        {/* LinkedIn Summary */}
        <Section title="LinkedIn Consistency">
          {c.linkedin_match_score != null && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${c.linkedin_flag === 'green' ? 'bg-emerald-500' : 'bg-red-400'}`}
                  style={{ width: `${c.linkedin_match_score}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-700">{Math.round(c.linkedin_match_score)}%</span>
            </div>
          )}
          <p className="text-sm text-slate-600 leading-relaxed">
            {c.linkedin_summary ?? 'No LinkedIn analysis available.'}
          </p>
        </Section>

        {/* Skills Matched */}
        <Section title="Skills">
          <div className="flex flex-wrap gap-2">
            {(c.skills_matched ?? []).map((s: string) => (
              <SkillTag key={s} label={s} matched={true} />
            ))}
            {(c.skills_not_matched ?? []).map((s: string) => (
              <SkillTag key={s} label={s} matched={false} />
            ))}
            {!(c.skills_matched?.length) && !(c.skills_not_matched?.length) && (
              <p className="text-sm text-slate-400">No skill data available.</p>
            )}
          </div>
        </Section>

        {/* Pros & Cons */}
        <Section title="Pros & Cons">
          <div className="space-y-3">
            {(c.pros ?? []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-emerald-700 mb-1.5 flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" /> Strengths
                </p>
                <ul className="space-y-1">
                  {(c.pros ?? []).map((p: string, i: number) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span className="text-emerald-500 mt-0.5 shrink-0">•</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(c.cons ?? []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1.5 flex items-center gap-1">
                  <ThumbsDown className="w-3.5 h-3.5" /> Gaps
                </p>
                <ul className="space-y-1">
                  {(c.cons ?? []).map((p: string, i: number) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span className="text-red-400 mt-0.5 shrink-0">•</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}
