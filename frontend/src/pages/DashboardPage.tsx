import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  Users,
  FileText,
  TrendingUp,
  Calendar,
  ChevronRight,
  Filter,
  ArrowLeft,
  Plus,
  Briefcase,
  Clock,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import { candidateService, jobService, recruiterService } from '../services/apiServices'
import { useAuthStore } from '../store/authStore'
import { StatusPill } from '../components/common/StatusPill'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { useState, useMemo, useEffect } from 'react'

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
}

interface DashboardPageProps {
  isAdminView?: boolean
}

export default function DashboardPage({ isAdminView = false }: DashboardPageProps) {
  const recruiter = useAuthStore((s) => s.recruiter)
  const userRole = useAuthStore((s) => s.userRole)
  const navigate = useNavigate()
  const { recruiterId } = useParams()
  const baseRole = userRole === 'admin' ? '/admin' : '/user'

  
  // Fetch recruiter data when in admin view
  const { data: viewedRecruiter } = useQuery({
    queryKey: ['recruiter', recruiterId],
    queryFn: () => recruiterService.getById(recruiterId!),
    enabled: isAdminView && !!recruiterId,
  })

  const viewingRecruiter = isAdminView && recruiterId ? viewedRecruiter : recruiter
  const displayName = viewingRecruiter?.user_name || (isAdminView ? 'Recruiter' : 'Dashboard')

  const [selectedClient, setSelectedClient] = useState<string>('All')
  const [selectedRole, setSelectedRole] = useState<string>('All')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
  const [selectedKpi, setSelectedKpi] = useState<'total_candidates' | 'shortlisted' | 'not_shortlisted' | 'in_process' | 'selected'>(
    'total_candidates'
  )

  const queryClient = useQueryClient()

  const { data: stats } = useQuery({
    queryKey: ['recruiter-stats', isAdminView ? recruiterId : 'me'],
    queryFn: () => isAdminView && recruiterId
      ? recruiterService.getStatsForRecruiter(recruiterId)
      : recruiterService.getStats(),
    enabled: isAdminView ? !!recruiterId : true,
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', isAdminView ? recruiterId : 'me'],
    queryFn: () => isAdminView && recruiterId
      ? jobService.listJobsForRecruiter(recruiterId)
      : jobService.listJobs(),
    enabled: isAdminView ? !!recruiterId : true,
    refetchInterval: 10000,
  })

  const { data: analyticsData } = useQuery({
    queryKey: ['client-analytics', isAdminView ? recruiterId : 'me'],
    queryFn: () => isAdminView && recruiterId
      ? jobService.getClientAnalyticsForRecruiter(recruiterId)
      : jobService.getClientAnalytics(),
    enabled: isAdminView ? !!recruiterId : true,
  })

  const reviewStatusMap: Record<string, string | undefined> = {
    total_candidates: undefined,
    shortlisted: 'shortlisted',
    not_shortlisted: 'not_shortlisted',
    in_process: 'in_process',
    selected: 'selected',
  }

  const { data: candidateData } = useQuery<{ candidates: any[]; total: number; page: number; page_size: number }, Error>({
    queryKey: ['candidates', selectedKpi, isAdminView ? recruiterId : 'me'],
    queryFn: () => {
      const params: any = {
        review_status: reviewStatusMap[selectedKpi],
        page: 1,
        page_size: 100,
      }
      
      // Add recruiter_id filter when in admin view
      if (isAdminView && recruiterId) {
        params.recruiter_id = recruiterId
      }
      
      return candidateService.listCandidates(params).then((result) => {
        // Client-side filtering since backend ignores recruiter_id
        if (isAdminView && recruiterId && result.candidates) {
          const filteredCandidates = result.candidates.filter((candidate: any) => 
            candidate.recruiter_id === recruiterId
          )
          
          return {
            ...result,
            candidates: filteredCandidates,
            total: filteredCandidates.length
          }
        }
        
        return result
      })
    },
    enabled: true,
  })

  const { data: totalCandidatesCount = 0 } = useQuery({
    queryKey: ['candidate-count', 'all', isAdminView ? recruiterId : 'me'],
    queryFn: () => {
      return candidateService.listCandidates({ page: 1, page_size: 1000 }).then((r) => {
        // Client-side filtering since backend ignores recruiter_id
        if (isAdminView && recruiterId && r.candidates) {
          const filteredCandidates = r.candidates.filter((candidate: any) => 
            candidate.recruiter_id === recruiterId
          )
          return filteredCandidates.length
        }
        return r.total
      })
    },
  })

  const { data: shortlistedCandidatesCount = 0 } = useQuery({
    queryKey: ['candidate-count', 'shortlisted', isAdminView ? recruiterId : 'me'],
    queryFn: () => {
      return candidateService.listCandidates({ review_status: 'shortlisted', page: 1, page_size: 1000 }).then((r) => {
        // Client-side filtering since backend ignores recruiter_id
        if (isAdminView && recruiterId && r.candidates) {
          const filteredCandidates = r.candidates.filter((candidate: any) => 
            candidate.recruiter_id === recruiterId
          )
          return filteredCandidates.length
        }
        return r.total
      })
    },
  })

  const { data: notShortlistedCandidatesCount = 0 } = useQuery({
    queryKey: ['candidate-count', 'not_shortlisted', isAdminView ? recruiterId : 'me'],
    queryFn: () => {
      return candidateService.listCandidates({ review_status: 'not_shortlisted', page: 1, page_size: 1000 }).then((r) => {
        // Client-side filtering since backend ignores recruiter_id
        if (isAdminView && recruiterId && r.candidates) {
          const filteredCandidates = r.candidates.filter((candidate: any) => 
            candidate.recruiter_id === recruiterId
          )
          return filteredCandidates.length
        }
        return r.total
      })
    },
  })

  const { data: inProcessCandidatesCount = 0 } = useQuery({
    queryKey: ['candidate-count', 'in_process', isAdminView ? recruiterId : 'me'],
    queryFn: () => {
      return candidateService.listCandidates({ review_status: 'in_process', page: 1, page_size: 1000 }).then((r) => {
        // Client-side filtering since backend ignores recruiter_id
        if (isAdminView && recruiterId && r.candidates) {
          const filteredCandidates = r.candidates.filter((candidate: any) => 
            candidate.recruiter_id === recruiterId
          )
          return filteredCandidates.length
        }
        return r.total
      })
    },
  })

  const { data: selectedCandidatesCount = 0 } = useQuery({
    queryKey: ['candidate-count', 'selected', isAdminView ? recruiterId : 'me'],
    queryFn: () => {
      return candidateService.listCandidates({ review_status: 'selected', page: 1, page_size: 1000 }).then((r) => {
        // Client-side filtering since backend ignores recruiter_id
        if (isAdminView && recruiterId && r.candidates) {
          const filteredCandidates = r.candidates.filter((candidate: any) => 
            candidate.recruiter_id === recruiterId
          )
          return filteredCandidates.length
        }
        return r.total
      })
    },
  })

  const reviewStatusMutation = useMutation({
    mutationFn: ({ candidateId, review_status }: { candidateId: string; review_status: string }) =>
      candidateService.updateReviewStatus(candidateId, review_status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          if (!Array.isArray(key)) return false
          return ['candidates', 'candidate-count', 'recruiter-stats', 'candidate'].includes(key[0] as string)
        },
      })
      queryClient.invalidateQueries({ queryKey: ['candidates', selectedKpi, isAdminView ? recruiterId : 'me'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-count', isAdminView ? recruiterId : 'me'] })
      queryClient.invalidateQueries({ queryKey: ['candidate'] })
    },
    onError: (error) => {
      console.error('Failed to update candidate status', error)
    },
  })

  const deleteCandidateMutation = useMutation({
    mutationFn: (candidateId: string) => candidateService.deleteCandidate(candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          if (!Array.isArray(key)) return false
          return ['candidates', 'candidate-count', 'recruiter-stats', 'candidate'].includes(key[0] as string)
        },
      })
      queryClient.invalidateQueries({ queryKey: ['candidates', selectedKpi, isAdminView ? recruiterId : 'me'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-count', isAdminView ? recruiterId : 'me'] })
    },
    onError: (error) => {
      console.error('Failed to delete candidate', error)
    },
  })

  const handleDeleteCandidate = (candidateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
      deleteCandidateMutation.mutate(candidateId)
    }
  }

  const clients = useMemo(() => {
    const clientSet = new Set<string>()
    jobs.forEach((job: any) => {
      const clientName = job.meta?.client_name || 'Unknown'
      clientSet.add(clientName)
    })
    return ['All', ...Array.from(clientSet)]
  }, [jobs])

  const normalizeValue = (value?: string) =>
    (value ?? '').trim().toLowerCase()

  const rolesForClient = useMemo(() => {
    const roleSet = new Set<string>()
    jobs.forEach((job: any) => {
      const clientName = job.meta?.client_name || 'Unknown'
      if (selectedClient !== 'All' && normalizeValue(clientName) !== normalizeValue(selectedClient)) return
      const role = job.job_title || job.meta?.session_name?.split(' - ')[1] || 'Unknown'
      roleSet.add(role)
    })
    return ['All', ...Array.from(roleSet)]
  }, [selectedClient, jobs])

  const sessionsForSelection = useMemo(() => {
    return jobs.filter((job: any) => {
      if (selectedClient !== 'All' && (job.meta?.client_name || 'Unknown') !== selectedClient) {
        return false
      }
      if (selectedRole !== 'All') {
        const role = job.job_title || job.meta?.session_name?.split(' - ')[1] || 'Unknown'
        return role === selectedRole
      }
      return true
    })
  }, [selectedClient, selectedRole, jobs])

  const filteredCandidates = useMemo(() => {
    if (!candidateData?.candidates) return []
    const selectedRoleNorm = normalizeValue(selectedRole)
    const selectedClientNorm = normalizeValue(selectedClient)

    return candidateData.candidates.filter((candidate: any) => {
      const clientName = normalizeValue(candidate.client_name)
      const candidateRole = normalizeValue(candidate.job_role || candidate.job_applied)
      const matchesClient = selectedClient === 'All' || clientName === selectedClientNorm
      const matchesRole =
        selectedRole === 'All' ||
        candidateRole === selectedRoleNorm ||
        candidateRole.includes(selectedRoleNorm) ||
        selectedRoleNorm.includes(candidateRole)
      return matchesClient && matchesRole
    })
  }, [candidateData?.candidates, selectedClient, selectedRole])

  const performanceData = useMemo(() => {
    const jobData = sessionsForSelection.map((job: any) => {
      const total = job.total_candidates || 0
      const selected = job.selected_candidates || Math.floor(total * 0.3)
      const conversion = total > 0 ? Math.round((selected / total) * 100) : 0

      return {
        date: new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        uploaded: total,
        selected,
        conversion,
        jobTitle: job.job_title,
      }
    }).slice(0, 7)

    return jobData
  }, [sessionsForSelection])

  const dynamicMetrics = useMemo(() => {
    const totalCandidates = totalCandidatesCount
    const shortlisted = shortlistedCandidatesCount
    const inProcess = inProcessCandidatesCount
    const notShortlisted = notShortlistedCandidatesCount
    const selected = selectedCandidatesCount
    const conversionRate = totalCandidates > 0 ? ((shortlisted / totalCandidates) * 100).toFixed(1) : '0'

    return {
      totalCandidates,
      shortlistedCandidates: shortlisted,
      notShortlistedCandidates: notShortlisted,
      inProcessCandidates: inProcess,
      selectedCandidates: selected,
      conversionRate,
      trend: '+0.0%',
      trendUp: true,
    }
  }, [totalCandidatesCount, shortlistedCandidatesCount, inProcessCandidatesCount, notShortlistedCandidatesCount, selectedCandidatesCount])

  const statusOptions = [
    { value: '', label: 'Select Status', disabled: true },
    { value: 'in_process', label: 'In Process' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'not_shortlisted', label: 'Not Shortlisted' },
    { value: 'selected', label: 'Selected' },
  ]

  const kpiCards = [
    {
      key: 'total_candidates',
      label: 'Total Candidates',
      value: dynamicMetrics.totalCandidates.toLocaleString(),
      icon: FileText,
      color: 'from-violet-500 to-violet-600',
      bgColor: 'bg-violet-50',
      subtext: `${dynamicMetrics.totalCandidates} total`,
    },
    {
      key: 'shortlisted',
      label: 'Shortlisted',
      value: dynamicMetrics.shortlistedCandidates.toLocaleString(),
      icon: CheckCircle2,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      subtext: 'Recruiter-approved',
    },
    {
      key: 'not_shortlisted',
      label: 'Not Shortlisted',
      value: dynamicMetrics.notShortlistedCandidates.toLocaleString(),
      icon: ChevronRight,
      color: 'from-rose-500 to-rose-600',
      bgColor: 'bg-rose-50',
      subtext: 'Rejected candidates',
    },
    {
      key: 'in_process',
      label: 'In Process',
      value: dynamicMetrics.inProcessCandidates.toLocaleString(),
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
      subtext: 'Under review',
    },
    {
      key: 'selected',
      label: 'Selected',
      value: dynamicMetrics.selectedCandidates.toLocaleString(),
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      subtext: 'Final selections',
    },
  ]

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isAdminView && (
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="btn-ghost p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isAdminView ? `${displayName}'s Dashboard` : 'Dashboard'}
              </h1>
              {isAdminView && viewingRecruiter && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                  <Briefcase className="w-3 h-3" />
                  {viewingRecruiter.post} • {viewingRecruiter.client}
                </p>
              )}
            </div>
          </div>
          {!isAdminView && (
            <div className="flex items-center gap-3">
              <Button onClick={() => navigate(`${baseRole}/analysis`)} leftIcon={<TrendingUp className="w-4 h-4" />} variant="secondary">
                Analysis
              </Button>
              <Button onClick={() => navigate(`${baseRole}/upload`)} leftIcon={<Plus className="w-4 h-4" />}>
                New Session
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpiCards.map(({ key, label, value, icon: Icon, color, bgColor, subtext }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKpi(key as any)}
              className={`relative overflow-hidden rounded-2xl border transition-all duration-300 h-32 p-4 text-left flex flex-col justify-between ${
                selectedKpi === key ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-100' : 'border-gray-200 bg-white hover:shadow-md'
              }`}
            >
              <div className={`absolute inset-0 ${bgColor} opacity-5 rounded-2xl`} />
              <div className="relative z-10 space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide leading-tight">{label}</p>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
              </div>
              <div className="relative z-10 flex items-end justify-between gap-2">
                <p className="text-xs text-gray-500 leading-tight flex-1">{subtext}</p>
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} p-1.5 text-white shadow-md flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-full h-full" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Candidate view filters */}
        <Card padding="md">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Candidate Filters</h3>
          </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => {
                    setSelectedClient(e.target.value)
                    setSelectedRole('All')
                  }}
                  className="select"
                >
                  {clients.map((client) => (
                    <option key={client} value={client}>{client}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Job Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="select"
                >
                  {rolesForClient.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">View</label>
                <div className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-semibold">
                  {selectedKpi.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')}
                </div>
              </div>
            </div>
          </Card>

        {/* Candidate list section */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Candidates</h3>
              <p className="text-sm text-gray-500 mt-1">
                {selectedKpi === 'total_candidates'
                  ? 'All candidate profiles for this recruiter'
                  : `Candidates filtered by ${selectedKpi.replace('_', ' ')}`}
              </p>
            </div>
          </div>

            <div className="space-y-4">
              {filteredCandidates.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                  <p className="text-sm text-gray-500">No candidates match the selected filters yet.</p>
                </div>
              ) : (
                filteredCandidates.map((candidate: any) => (
                  <div
                    key={candidate.id}
                    className="grid grid-cols-1 gap-4 rounded-3xl border border-gray-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center hover:shadow-sm hover:border-primary-200 transition-all"
                  >
                    <Link
                      to={`${baseRole}/candidates/${candidate.id}`}
                      className="space-y-2 cursor-pointer"
                    >
                      <p className="text-base font-semibold text-gray-900">{candidate.name || 'Unknown Candidate'}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {candidate.job_role || candidate.job_applied || 'No role specified'} • {candidate.client_name || 'No client'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">Uploaded {new Date(candidate.created_at).toLocaleDateString()}</p>
                    </Link>
                    <div className="flex flex-col gap-3 md:items-end">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          ATS Score: {candidate.ats_score ?? '—'}
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Match Score: {candidate.linkedin_match_score ?? '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-auto">
                          <label className="label text-xs font-semibold text-gray-500">Status</label>
                          <select
                            value={candidate.review_status === 'in_process' ? '' : candidate.review_status ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              reviewStatusMutation.mutate({
                                candidateId: candidate.id,
                                review_status: e.target.value,
                              })
                            }
                            className="select w-full"
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value} disabled={option.disabled}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={(e) => handleDeleteCandidate(candidate.id, e)}
                          disabled={deleteCandidateMutation.isPending}
                          className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors self-end"
                          title="Delete candidate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
      </div>
    </div>
  )
}
