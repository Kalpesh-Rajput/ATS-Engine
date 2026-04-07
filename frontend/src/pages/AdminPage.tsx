import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Users,
  UserCheck,
  TrendingUp,
  LogOut,
  UserPlus,
  Pencil,
  Trash2,
  X,
  Brain,
  Monitor,
  Mail,
  Lock,
  Search,
} from 'lucide-react'
import { recruiterService, candidateService, jobService, uploadService } from '../services/apiServices'
import { useAuthStore } from '../store/authStore'

interface Recruiter {
  id: string
  user_name: string
  email: string
  is_admin: boolean
  total_resumes_uploaded: number
  total_shortlisted: number
  total_jobs?: number
  created_at?: string
}

interface Candidate {
  id: string
  full_name: string
  email?: string
  status: string
  ats_score?: number
  linkedin_url?: string
  recruiter_id: string
  scoring_job_id?: string
  created_at?: string
}

interface Job {
  id: string
  client_name: string
  job_title?: string
  status: string
  total_candidates: number
  processed_candidates: number
  failed_candidates: number
  recruiter_id: string
  created_at?: string
  completed_at?: string
}

interface UploadFile {
  id: string
  filename: string
  type: 'job_description' | 'resume' | 'linkedin'
  recruiter_id: string
  job_id: string
  size_bytes: number
  created_at: number
}

interface RecruiterFormData {
  user_name: string
  email: string
  password: string
}

export default function AdminPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const logout = useAuthStore((s) => s.logout)
  const recruiter = useAuthStore((s) => s.recruiter)
  const [activeTab, setActiveTab] = useState<'overview' | 'recruiters' | 'candidates' | 'jobs' | 'uploads'>('overview')
  const [searchQuery, setSearchQuery] = useState('')

  // Recruiter modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedRecruiter, setSelectedRecruiter] = useState<Recruiter | null>(null)

  // Candidate modal state
  const [isDeleteCandidateModalOpen, setIsDeleteCandidateModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('')
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>('')

  // Job modal state
  const [isDeleteJobModalOpen, setIsDeleteJobModalOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [jobSearchQuery, setJobSearchQuery] = useState('')
  const [jobStatusFilter, setJobStatusFilter] = useState<string>('')

  // Uploads state
  const [uploadSearchQuery, setUploadSearchQuery] = useState('')
  const [uploadTypeFilter, setUploadTypeFilter] = useState<string>('')

  // Form state
  const [formData, setFormData] = useState<RecruiterFormData>({
    user_name: '',
    email: '',
    password: '',
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const { data: recruiters = [] } = useQuery({
    queryKey: ['recruiters'],
    queryFn: recruiterService.listAll,
  })

  const { data: candidatesData, refetch: refetchCandidates } = useQuery({
    queryKey: ['all-candidates', candidateStatusFilter],
    queryFn: () => candidateService.listAllCandidates({ status: candidateStatusFilter || undefined }),
    enabled: activeTab === 'candidates',
  })
  const candidates = candidatesData?.candidates || []

  const { data: jobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ['all-jobs', jobStatusFilter],
    queryFn: () => jobService.listAllJobs(),
    enabled: activeTab === 'jobs',
  })

  const { data: uploads = [] } = useQuery({
    queryKey: ['all-uploads'],
    queryFn: () => uploadService.listAllUploads(),
    enabled: activeTab === 'uploads',
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: recruiterService.createRecruiter,
    onSuccess: () => {
      toast.success('Recruiter created successfully')
      queryClient.invalidateQueries({ queryKey: ['recruiters'] })
      setIsAddModalOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create recruiter')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { user_name: string; email: string } }) =>
      recruiterService.updateRecruiter(id, data),
    onSuccess: () => {
      toast.success('Recruiter updated successfully')
      queryClient.invalidateQueries({ queryKey: ['recruiters'] })
      setIsEditModalOpen(false)
      setSelectedRecruiter(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update recruiter')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: recruiterService.deleteRecruiter,
    onSuccess: () => {
      toast.success('Recruiter deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['recruiters'] })
      setIsDeleteModalOpen(false)
      setSelectedRecruiter(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete recruiter')
    },
  })

  // Delete candidate mutation
  const deleteCandidateMutation = useMutation({
    mutationFn: (id: string) => candidateService.adminDeleteCandidate(id),
    onSuccess: () => {
      toast.success('Candidate deleted successfully')
      refetchCandidates()
      setIsDeleteCandidateModalOpen(false)
      setSelectedCandidate(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete candidate')
    },
  })

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: (id: string) => jobService.adminDeleteJob(id),
    onSuccess: () => {
      toast.success('Session deleted successfully')
      refetchJobs()
      setIsDeleteJobModalOpen(false)
      setSelectedJob(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete session')
    },
  })

  const resetForm = () => {
    setFormData({ user_name: '', email: '', password: '' })
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.user_name || !formData.email || !formData.password) {
      toast.error('Please fill in all fields')
      return
    }
    createMutation.mutate(formData)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRecruiter) return
    if (!formData.user_name || !formData.email) {
      toast.error('Please fill in all fields')
      return
    }
    updateMutation.mutate({
      id: selectedRecruiter.id,
      data: { user_name: formData.user_name, email: formData.email },
    })
  }

  const handleDelete = () => {
    if (!selectedRecruiter) return
    deleteMutation.mutate(selectedRecruiter.id)
  }

  const handleDeleteCandidate = () => {
    if (!selectedCandidate) return
    deleteCandidateMutation.mutate(selectedCandidate.id)
  }

  const openEditModal = (recruiter: Recruiter) => {
    setSelectedRecruiter(recruiter)
    setFormData({
      user_name: recruiter.user_name,
      email: recruiter.email,
      password: '',
    })
    setIsEditModalOpen(true)
  }

  const openDeleteModal = (recruiter: Recruiter) => {
    setSelectedRecruiter(recruiter)
    setIsDeleteModalOpen(true)
  }

  const openDeleteCandidateModal = (candidate: Candidate) => {
    setSelectedCandidate(candidate)
    setIsDeleteCandidateModalOpen(true)
  }

  const openDeleteJobModal = (job: Job) => {
    setSelectedJob(job)
    setIsDeleteJobModalOpen(true)
  }

  const handleDeleteJob = () => {
    if (!selectedJob) return
    deleteJobMutation.mutate(selectedJob.id)
  }

  const getRecruiterName = (id: string) => {
    const r = recruiters.find((rec: Recruiter) => rec.id === id)
    return r?.user_name || 'Unknown'
  }

  const getJobProgress = (job: Job) => {
    if (job.total_candidates === 0) return 0
    return Math.round((job.processed_candidates / job.total_candidates) * 100)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'job_description':
        return 'Job Description'
      case 'resume':
        return 'Resume'
      case 'linkedin':
        return 'LinkedIn'
      default:
        return type
    }
  }

  // Filter uploads based on search and type
  const filteredUploads = uploads.filter((u: UploadFile) => {
    const matchesSearch = u.filename.toLowerCase().includes(uploadSearchQuery.toLowerCase()) ||
      getRecruiterName(u.recruiter_id).toLowerCase().includes(uploadSearchQuery.toLowerCase())
    const matchesType = uploadTypeFilter ? u.type === uploadTypeFilter : true
    return matchesSearch && matchesType
  })

  // Filter recruiters based on search
  const filteredRecruiters = recruiters.filter(
    (r: Recruiter) =>
      r.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filter candidates based on search
  const filteredCandidates = candidates.filter(
    (c: Candidate) =>
      c.full_name.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(candidateSearchQuery.toLowerCase())
  )

  // Filter jobs based on search and status
  const filteredJobs = jobs.filter((j: Job) => {
    const matchesSearch =
      j.client_name.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
      j.job_title?.toLowerCase().includes(jobSearchQuery.toLowerCase())
    const matchesStatus = jobStatusFilter ? j.status === jobStatusFilter : true
    return matchesSearch && matchesStatus
  })

  // Admin metrics
  const adminMetrics = {
    totalRecruiters: recruiters.length,
    totalSessions: recruiters.reduce((sum: number, r: Recruiter) => sum + (r.total_jobs || 0), 0),
    totalCandidates: recruiters.reduce((sum: number, r: Recruiter) => sum + (r.total_resumes_uploaded || 0), 0),
    avgTimeToHire: '21 days',
  }

  const recruiterPerformanceData = recruiters.map((r: Recruiter) => ({
    name: r.user_name,
    candidates: r.total_resumes_uploaded,
    shortlisted: r.total_shortlisted,
    rate: r.total_resumes_uploaded > 0 ? Math.round((r.total_shortlisted / r.total_resumes_uploaded) * 100) : 0,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-950 to-teal-950">
      {/* Header */}
      <div className="border-b border-cyan-200/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500 text-slate-950 flex items-center justify-center font-bold">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-cyan-100">Admin Dashboard</h1>
                <p className="text-cyan-200/70 text-sm">System-wide analytics and recruiter management</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-cyan-200/70 hover:text-cyan-100 hover:bg-cyan-500/10 transition-all border border-cyan-200/10"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card p-6 hover:border-cyan-300/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-cyan-200/60 text-sm font-medium">Total Recruiters</p>
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-cyan-100">{adminMetrics.totalRecruiters}</p>
          </div>

          <div className="card p-6 hover:border-cyan-300/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-cyan-200/60 text-sm font-medium">Total Sessions</p>
              <Monitor className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-cyan-100">{adminMetrics.totalSessions}</p>
          </div>

          <div className="card p-6 hover:border-cyan-300/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-cyan-200/60 text-sm font-medium">Candidates Processed</p>
              <UserCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-cyan-100">{adminMetrics.totalCandidates}</p>
          </div>

          <div className="card p-6 hover:border-cyan-300/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-cyan-200/60 text-sm font-medium">Avg Time to Hire</p>
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-cyan-100">{adminMetrics.avgTimeToHire}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-cyan-200/10">
          {['overview', 'recruiters', 'candidates', 'jobs', 'uploads'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-cyan-400 text-cyan-100'
                  : 'border-transparent text-cyan-200/60 hover:text-cyan-100'
              }`}
            >
              {tab === 'jobs' ? 'Sessions' : tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-cyan-100 mb-6">Recruiter Performance</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={recruiterPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.1)" />
                    <XAxis stroke="rgba(14, 15, 15, 0.5)" />
                    <YAxis stroke="rgba(22, 26, 27, 0.5)" />
                    <Tooltip contentStyle={{ backgroundColor: '#021026', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '8px', color: '#06b6d4' }} />
                    <Legend />
                    <Bar dataKey="candidates" fill="#113f47" />
                    <Bar dataKey="shortlisted" fill="#063123" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-cyan-100 mb-6">Selection Rate by Recruiter</h2>
                <div className="space-y-4">
                  {recruiterPerformanceData.map((r: any) => (
                    <div key={r.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-cyan-200/80 font-medium">{r.name}</span>
                        <span className="text-cyan-100 font-semibold">{r.rate}%</span>
                      </div>
                      <div className="h-2 bg-cyan-500/20 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full" style={{ width: `${r.rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recruiters Tab */}
        {activeTab === 'recruiters' && (
          <div className="card">
            <div className="px-6 py-4 border-b border-cyan-200/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-cyan-100">All Recruiters</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                  <input
                    type="text"
                    placeholder="Search recruiters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-sm text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  resetForm()
                  setIsAddModalOpen(true)
                }}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Recruiter
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cyan-500/10 border-b border-cyan-200/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Sessions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Candidates</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Success Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-200/10">
                  {filteredRecruiters.map((r: Recruiter) => (
                    <tr key={r.id} className="hover:bg-cyan-500/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-cyan-100 font-medium">{r.user_name}</td>
                      <td className="px-6 py-4 text-sm text-cyan-200/70">{r.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            r.is_admin
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {r.is_admin ? 'Admin' : 'Recruiter'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-cyan-100">{r.total_jobs || 0}</td>
                      <td className="px-6 py-4 text-sm text-cyan-100">{r.total_resumes_uploaded || 0}</td>
                      <td className="px-6 py-4 text-sm text-cyan-100">
                        {r.total_resumes_uploaded > 0
                          ? `${Math.round((r.total_shortlisted / r.total_resumes_uploaded) * 100)}%`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(r)}
                            className="p-2 rounded-lg text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(r)}
                            className="p-2 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                            disabled={r.id === recruiter?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRecruiters.length === 0 && (
                <div className="text-center py-12 text-cyan-200/50">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recruiters found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Candidates Tab */}
        {activeTab === 'candidates' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">TOTAL CANDIDATES</p>
                <p className="text-2xl font-bold text-cyan-100">{candidatesData?.total || 0}</p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">SHORTLISTED</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {candidates.filter((c: Candidate) => c.status === 'shortlisted').length}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">PENDING</p>
                <p className="text-2xl font-bold text-amber-400">
                  {candidates.filter((c: Candidate) => c.status === 'pending').length}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">AVG SCORE</p>
                <p className="text-2xl font-bold text-cyan-100">
                  {candidates.length > 0
                    ? Math.round(
                        candidates.reduce((sum: number, c: Candidate) => sum + (c.ats_score || 0), 0) / candidates.length
                      )
                    : 0}
                </p>
              </div>
            </div>

            {/* Candidates Table */}
            <div className="card">
              <div className="px-6 py-4 border-b border-cyan-200/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-cyan-100">All Candidates</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                    <input
                      type="text"
                      placeholder="Search candidates..."
                      value={candidateSearchQuery}
                      onChange={(e) => setCandidateSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-sm text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                <select
                  value={candidateStatusFilter}
                  onChange={(e) => setCandidateStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-sm text-cyan-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-cyan-500/10 border-b border-cyan-200/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Recruiter</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-200/10">
                    {filteredCandidates.map((c: Candidate) => (
                      <tr key={c.id} className="hover:bg-cyan-500/5 transition-colors">
                        <td className="px-6 py-4 text-sm text-cyan-100 font-medium">{c.full_name}</td>
                        <td className="px-6 py-4 text-sm text-cyan-200/70">{c.email || '—'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              c.status === 'shortlisted'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : c.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-red-500/20 text-red-300 border-red-500/30'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-cyan-100">
                          {c.ats_score ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-cyan-500/20 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                                  style={{ width: `${c.ats_score}%` }}
                                />
                              </div>
                              <span className="text-xs">{c.ats_score}</span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-cyan-200/70">{getRecruiterName(c.recruiter_id)}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {c.linkedin_url && (
                              <a
                                href={c.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
                                title="View LinkedIn"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                              </a>
                            )}
                            <button
                              onClick={() => openDeleteCandidateModal(c)}
                              className="p-2 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredCandidates.length === 0 && (
                  <div className="text-center py-12 text-cyan-200/50">
                    <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No candidates found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Jobs/Sessions Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">TOTAL SESSIONS</p>
                <p className="text-2xl font-bold text-cyan-100">{jobs.length}</p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">COMPLETED</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {jobs.filter((j: Job) => j.status === 'completed').length}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">PROCESSING</p>
                <p className="text-2xl font-bold text-amber-400">
                  {jobs.filter((j: Job) => j.status === 'processing').length}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">TOTAL CANDIDATES</p>
                <p className="text-2xl font-bold text-cyan-100">
                  {jobs.reduce((sum: number, j: Job) => sum + j.total_candidates, 0)}
                </p>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="card">
              <div className="px-6 py-4 border-b border-cyan-200/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-cyan-100">All Sessions</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                    <input
                      type="text"
                      placeholder="Search sessions..."
                      value={jobSearchQuery}
                      onChange={(e) => setJobSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-sm text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                <select
                  value={jobStatusFilter}
                  onChange={(e) => setJobStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-sm text-cyan-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-cyan-500/10 border-b border-cyan-200/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Job Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Candidates</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Recruiter</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-200/10">
                    {filteredJobs.map((j: Job) => (
                      <tr key={j.id} className="hover:bg-cyan-500/5 transition-colors">
                        <td className="px-6 py-4 text-sm text-cyan-100 font-medium">{j.client_name}</td>
                        <td className="px-6 py-4 text-sm text-cyan-200/70">{j.job_title || '—'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              j.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : j.status === 'processing'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : j.status === 'pending'
                                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                            }`}
                          >
                            {j.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-cyan-100">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-cyan-500/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                                style={{ width: `${getJobProgress(j)}%` }}
                              />
                            </div>
                            <span className="text-xs">{getJobProgress(j)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-cyan-100">
                          {j.processed_candidates}/{j.total_candidates}
                          {j.failed_candidates > 0 && (
                            <span className="text-red-400 ml-2">({j.failed_candidates} failed)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-cyan-200/70">{getRecruiterName(j.recruiter_id)}</td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => openDeleteJobModal(j)}
                            className="p-2 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                            title="Delete Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredJobs.length === 0 && (
                  <div className="text-center py-12 text-cyan-200/50">
                    <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No sessions found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Uploads Tab */}
        {activeTab === 'uploads' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">TOTAL FILES</p>
                <p className="text-2xl font-bold text-cyan-100">{uploads.length}</p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">JOB DESCRIPTIONS</p>
                <p className="text-2xl font-bold text-purple-400">
                  {uploads.filter((u: UploadFile) => u.type === 'job_description').length}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">RESUMES</p>
                <p className="text-2xl font-bold text-amber-400">
                  {uploads.filter((u: UploadFile) => u.type === 'resume').length}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-cyan-200/60 text-xs font-medium mb-1">LINKEDIN PROFILES</p>
                <p className="text-2xl font-bold text-blue-400">
                  {uploads.filter((u: UploadFile) => u.type === 'linkedin').length}
                </p>
              </div>
            </div>

            {/* Uploads Table */}
            <div className="card">
              <div className="px-6 py-4 border-b border-cyan-200/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-cyan-100">All Uploaded Files</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={uploadSearchQuery}
                      onChange={(e) => setUploadSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-sm text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                <select
                  value={uploadTypeFilter}
                  onChange={(e) => setUploadTypeFilter(e.target.value)}
                  className="px-4 py-2 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-sm text-cyan-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="">All Types</option>
                  <option value="job_description">Job Description</option>
                  <option value="resume">Resume</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-cyan-500/10 border-b border-cyan-200/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Filename</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Recruiter</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-200 uppercase">Uploaded At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-200/10">
                    {filteredUploads.map((u: UploadFile) => (
                      <tr key={u.id} className="hover:bg-cyan-500/5 transition-colors">
                        <td className="px-6 py-4 text-sm text-cyan-100 font-medium">{u.filename}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              u.type === 'job_description'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : u.type === 'resume'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {getFileTypeLabel(u.type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-cyan-200/70">{formatFileSize(u.size_bytes)}</td>
                        <td className="px-6 py-4 text-sm text-cyan-200/70">{getRecruiterName(u.recruiter_id)}</td>
                        <td className="px-6 py-4 text-sm text-cyan-200/70">{formatDate(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUploads.length === 0 && (
                  <div className="text-center py-12 text-cyan-200/50">
                    <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No files found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Recruiter Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-cyan-100">Add New Recruiter</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-lg text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-cyan-200/80 mb-2">Full Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                  <input
                    type="text"
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                    placeholder="Enter full name"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-cyan-200/80 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                    placeholder="Enter email address"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-cyan-200/80 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-cyan-200/20 text-cyan-200 hover:bg-cyan-500/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-cyan-950 border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Create Recruiter
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Recruiter Modal */}
      {isEditModalOpen && selectedRecruiter && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-cyan-100">Edit Recruiter</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-lg text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-cyan-200/80 mb-2">Full Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                  <input
                    type="text"
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                    placeholder="Enter full name"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-cyan-200/80 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/50" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-cyan-500/10 border border-cyan-200/20 rounded-lg text-cyan-100 placeholder:text-cyan-200/50 focus:outline-none focus:border-cyan-400"
                    placeholder="Enter email address"
                    required
                  />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-200/10">
                <p className="text-sm text-cyan-200/70">
                  <span className="font-medium text-cyan-200">Role:</span>{' '}
                  {selectedRecruiter.is_admin ? 'Admin' : 'Recruiter'}
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-cyan-200/20 text-cyan-200 hover:bg-cyan-500/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-cyan-950 border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Pencil className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Recruiter Confirmation Modal */}
      {isDeleteModalOpen && selectedRecruiter && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-cyan-100">Delete Recruiter</h3>
                <p className="text-sm text-cyan-200/70">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-cyan-200/80">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-cyan-100">{selectedRecruiter.user_name}</span>? All their data will be
              permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-cyan-200/20 text-cyan-200 hover:bg-cyan-500/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Candidate Confirmation Modal */}
      {isDeleteCandidateModalOpen && selectedCandidate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-cyan-100">Delete Candidate</h3>
                <p className="text-sm text-cyan-200/70">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-cyan-200/80">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-cyan-100">{selectedCandidate.full_name}</span>? This will permanently
              remove their profile and scoring data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteCandidateModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-cyan-200/20 text-cyan-200 hover:bg-cyan-500/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCandidate}
                disabled={deleteCandidateMutation.isPending}
                className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {deleteCandidateMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Job Confirmation Modal */}
      {isDeleteJobModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-cyan-100">Delete Session</h3>
                <p className="text-sm text-cyan-200/70">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-cyan-200/80">
              Are you sure you want to delete the session for{' '}
              <span className="font-semibold text-cyan-100">{selectedJob.client_name}</span>? This will permanently
              remove the session and all {selectedJob.total_candidates} associated candidates.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteJobModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-cyan-200/20 text-cyan-200 hover:bg-cyan-500/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteJob}
                disabled={deleteJobMutation.isPending}
                className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {deleteJobMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
