import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Flag, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { candidateService, jobService } from '../services/apiServices'
import { useAuthStore } from '../store/authStore'
import JobStatusBadge from '../components/dashboard/JobStatusBadge'
import ScoreRing from '../components/candidates/ScoreRing'

interface CandidateRow {
  id: string
  resume: File | null
  linkedin: File | null
}

function newRow(): CandidateRow {
  return { id: crypto.randomUUID(), resume: null, linkedin: null }
}

export default function JobResultsPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const userRole = useAuthStore((s) => s.userRole)
  const baseRole = userRole === 'admin' ? '/admin' : '/user'
  const [minScore, setMinScore] = useState<number>(0)
  const [isAdding, setIsAdding] = useState(false)
  const [rows, setRows] = useState<CandidateRow[]>([newRow()])
  const queryClient = useQueryClient()

  const statusOptions = [
    { value: '', label: 'Choose Status', disabled: true },
    { value: 'in_process', label: 'In Process' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'not_shortlisted', label: 'Not Shortlisted' },
    { value: 'selected', label: 'Selected' },
  ]

  const reviewStatusMutation = useMutation({
    mutationFn: ({ candidateId, review_status }: { candidateId: string; review_status: string }) =>
      candidateService.updateReviewStatus(candidateId, review_status),
    onSuccess: () => {
      toast.success('Status updated')
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      queryClient.invalidateQueries({ queryKey: ['candidates', jobId] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  const deleteCandidateMutation = useMutation({
    mutationFn: (candidateId: string) => candidateService.deleteCandidate(candidateId),
    onSuccess: () => {
      toast.success('Candidate deleted successfully')
      // Invalidate all candidate-related queries to reflect deletion everywhere
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          if (!Array.isArray(key)) return false
          return ['candidates', 'candidate-count', 'candidate'].includes(key[0] as string)
        },
      })
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      queryClient.invalidateQueries({ queryKey: ['recruiter-stats'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete candidate')
    },
  })

  const handleDeleteCandidate = (candidateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
      deleteCandidateMutation.mutate(candidateId)
    }
  }

  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) => jobService.cancelJob(jobId),
    onSuccess: () => {
      // Show brief toast notification (2-3 seconds)
      toast.success('Job cancelled', { duration: 2500 })
      // Invalidate ALL queries to ensure no stale job/candidate data remains
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          if (!Array.isArray(key)) return true
          // Invalidate job, candidate, and stats related queries
          const invalidateKeys = ['job', 'jobs', 'candidates', 'candidate', 'recruiter-stats']
          return invalidateKeys.some(k => key[0] === k)
        },
      })
      // Reset queries cache completely to remove any cancelled job data
      queryClient.refetchQueries({ queryKey: ['jobs'] })
      // Navigate to dashboard immediately
      navigate(`${baseRole}/dashboard`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to cancel job')
    },
  })

  const deleteJobMutation = useMutation({
    mutationFn: (jobId: string) => jobService.adminDeleteJob(jobId),
    onSuccess: () => {
      toast.success('Session deleted successfully')
      // Invalidate ALL queries to ensure no stale job/candidate data remains
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          if (!Array.isArray(key)) return true
          // Invalidate job, candidate, and stats related queries
          const invalidateKeys = ['job', 'jobs', 'candidates', 'candidate', 'recruiter-stats', 'client-analytics']
          return invalidateKeys.some(k => key[0] === k)
        },
      })
      // Reset queries cache completely to remove any deleted job data
      queryClient.refetchQueries({ queryKey: ['jobs'] })
      // Navigate to dashboard immediately
      navigate(`${baseRole}/dashboard`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete session')
    },
  })

  const handleDeleteJob = () => {
    if (window.confirm('Are you sure you want to delete this session? All candidates and associated data will be permanently deleted. This action cannot be undone.')) {
      deleteJobMutation.mutate(jobId!)
    }
  }

  const handleCancelJob = () => {
    if (window.confirm('Are you sure you want to cancel this job? All candidates from this session will be permanently deleted. This action cannot be undone.')) {
      cancelJobMutation.mutate(jobId!)
    }
  }

  const addRow = () => setRows((r) => [...r, newRow()])
  const updateRow = (id: string, field: 'resume' | 'linkedin', file: File | null) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: file } : row)))
  const removeRow = (id: string) => setRows((r) => (r.length === 1 ? r : r.filter((row) => row.id !== id)))

  const { data: job, refetch: refetchJob } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobService.getJob(jobId!),
    refetchInterval: (query) => {
      const jobData = query.state.data;
      return jobData?.status === 'completed' || jobData?.status === 'failed' ? false : 3000;
    },
  })

  const { data: candidateData, refetch: refetchCandidates } = useQuery({
    queryKey: ['candidates', jobId, minScore],
    queryFn: () =>
      candidateService.listCandidates({
        job_id: jobId,
        status: 'completed',
        min_score: minScore || undefined,
        page_size: 50,
      }),
  })

  const candidates = candidateData?.candidates ?? []
  const isProcessing = job?.status === 'processing' || job?.status === 'pending'

  // Re-fetch candidates when job finishes
  useEffect(() => {
    if (job?.status === 'completed' || job?.status === 'partial') {
      refetchCandidates()
    }
  }, [job?.status])

  const progress =
    job?.total_candidates > 0
      ? Math.round((job.processed_candidates / job.total_candidates) * 100)
      : 0

  const handleAddCandidates = async () => {
    if (!jobId) return
    const incomplete = rows.filter((r) => !r.resume || !r.linkedin)
    if (incomplete.length > 0) return toast.error('Every candidate needs both resume and LinkedIn documents')

    const form = new FormData()
    rows.forEach((r) => {
      form.append('resumes', r.resume!)
      form.append('linkedin_profiles', r.linkedin!)
    })

    try {
      await jobService.addCandidates(jobId, form)
      toast.success(`Added ${rows.length} candidate(s) to this session`)
      setIsAdding(false)
      setRows([newRow()])
      refetchJob()
      refetchCandidates()
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Could not add candidates')
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`${baseRole}/dashboard`)}
          className="btn-secondary p-2"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {job?.job_title ?? job?.jd_path?.split('/').pop() ?? 'Scoring Job'}
            </h1>
            {job && <JobStatusBadge status={job.status} />}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {job?.total_candidates} candidates · created {job && new Date(job.created_at).toLocaleString()}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setIsAdding(true)}
              className="btn-secondary inline-flex items-center gap-2 text-xs"
              disabled={!job || job.status === 'failed' || job.status === 'cancelled'}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Candidates
            </button>
            {(job?.status === 'processing' || job?.status === 'pending') && (
              <button
                onClick={handleCancelJob}
                disabled={cancelJobMutation.isPending}
                className="btn-secondary inline-flex items-center gap-2 text-xs bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Cancel Job
              </button>
            )}
            {(job?.status === 'completed' || job?.status === 'failed' || job?.status === 'cancelled') && (
              <button
                onClick={handleDeleteJob}
                disabled={deleteJobMutation.isPending}
                className="btn-secondary inline-flex items-center gap-2 text-xs bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add candidates modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-3xl space-y-4 rounded-2xl border border-gray-200/90 bg-white p-6 shadow-2xl ring-1 ring-black/5 animate-scale-in">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add Job Candidates</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Upload resumes and LinkedIn documents. JD is reused from this session.
                </p>
              </div>
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">Resume {idx + 1}</label>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={(e) => updateRow(row.id, 'resume', e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-slate-500"
                    />
                    {row.resume && <p className="text-xs text-slate-500">{row.resume.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">LinkedIn {idx + 1}</label>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={(e) => updateRow(row.id, 'linkedin', e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-slate-500"
                    />
                    {row.linkedin && <p className="text-xs text-slate-500">{row.linkedin.name}</p>}
                  </div>

                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                    title="Remove candidate"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button onClick={addRow} className="btn-secondary text-xs inline-flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Add candidate
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsAdding(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button onClick={handleAddCandidates} className="btn-primary text-xs inline-flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Add Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar (while processing) */}
      {isProcessing && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
              Scoring candidates…
            </span>
            <span className="font-medium text-slate-900">
              {job?.processed_candidates ?? 0} / {job?.total_candidates ?? 0}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Results appear as each candidate is processed.</p>
            <button
              onClick={handleCancelJob}
              disabled={cancelJobMutation.isPending}
              className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
              Stop Processing
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {candidates.length > 0 && (
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-600 flex items-center gap-2">
            Minimum ATS score:
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-32 accent-primary-600"
            />
            <span className="font-medium w-10 text-slate-900">{minScore}%</span>
          </label>
          <span className="text-sm text-slate-400 ml-auto">
            Showing {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Candidate list */}
      {candidates.length === 0 && !isProcessing ? (
        <div className="card p-12 text-center text-slate-400">
          <p className="text-sm">No completed candidates yet. Check back shortly.</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {candidates.map((c: any) => (
            <div
              key={c.id}
              className="flex items-center gap-5 px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              {/* Score ring */}
              <ScoreRing score={c.ats_score ?? 0} size={52} />

              {/* Info */}
              <Link
                to={`${baseRole}/candidates/${c.id}`}
                className="flex-1 min-w-0 space-y-1 cursor-pointer"
              >
                <p className="font-medium text-slate-900 truncate">
                  {c.name ?? 'Unknown Candidate'}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {[c.email, c.location].filter(Boolean).join(' · ')}
                </p>
              </Link>

              {/* Skills matched */}
              <div className="hidden sm:flex flex-wrap gap-1 max-w-xs justify-end">
                {(c.skills_matched ?? []).slice(0, 4).map((s: string) => (
                  <span key={s} className="badge-green">{s}</span>
                ))}
                {(c.skills_matched ?? []).length > 4 && (
                  <span className="badge-gray">+{c.skills_matched.length - 4}</span>
                )}
              </div>

              {/* LinkedIn flag */}
              <span className={c.linkedin_flag === 'green' ? 'badge-green' : 'badge-red'}>
                <Flag className="w-3 h-3" />
                {c.linkedin_flag === 'green' ? 'Green' : 'Red'}
              </span>

              {/* Status dropdown */}
              <select
                value={c.review_status === 'in_process' ? '' : c.review_status ?? ''}
                onChange={(e) => {
                  e.stopPropagation()
                  reviewStatusMutation.mutate({
                    candidateId: c.id,
                    review_status: e.target.value,
                  })
                }}
                disabled={reviewStatusMutation.isPending}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                onClick={(e) => handleDeleteCandidate(c.id, e)}
                disabled={deleteCandidateMutation.isPending}
                className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Delete candidate"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
