import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BarChart2, CheckCircle, FileText, Plus, Users } from 'lucide-react'
import { jobService, recruiterService } from '../services/apiServices'
import { useAuthStore } from '../store/authStore'
import JobStatusBadge from '../components/dashboard/JobStatusBadge'

export default function DashboardPage() {
  const recruiter = useAuthStore((s) => s.recruiter)
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['recruiter-stats'],
    queryFn: recruiterService.getStats,
  })

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: jobService.listJobs,
    refetchInterval: 5000, // poll every 5s for in-progress jobs
  })

  const statCards = [
    { label: 'Resumes uploaded', value: stats?.total_resumes_uploaded ?? 0, icon: FileText, color: 'text-blue-600 bg-blue-50' },
    { label: 'Shortlisted', value: stats?.total_shortlisted ?? 0, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Scoring jobs', value: stats?.total_jobs ?? 0, icon: BarChart2, color: 'text-violet-600 bg-violet-50' },
  ]

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {recruiter?.user_name} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Here's your recruitment activity at a glance.</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/upload')}>
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <div className={`rounded-xl p-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Jobs table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Scoring Jobs</h2>
        </div>

        {jobsLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No jobs yet. Upload a job description to get started.</p>
            <button className="btn-primary mt-4" onClick={() => navigate('/upload')}>
              <Plus className="w-4 h-4" /> New Job
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.map((job: any) => (
              <div
                key={job.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {job.job_title ?? job.jd_path?.split('/').pop() ?? `Job ${job.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(job.created_at).toLocaleDateString()} · {job.total_candidates} candidates
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">
                    {job.processed_candidates}/{job.total_candidates} processed
                  </span>
                  <JobStatusBadge status={job.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
