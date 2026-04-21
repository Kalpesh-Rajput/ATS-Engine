import { ChangeEvent, useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
} from 'recharts'
import { 
  ArrowLeft, 
  Filter, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  Activity,
  Target,
  Zap,
  BarChart3,
  Download,
  RefreshCw
} from 'lucide-react'
import { candidateService, jobService, recruiterService } from '../services/apiServices'
import { useAuthStore } from '../store/authStore'
import { Card } from '../components/common/Card'

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#3b82f6']
const STATUS_COLORS = {
  shortlisted: '#10b981',
  not_shortlisted: '#ef4444',
  in_process: '#f59e0b',
  selected: '#3b82f6',
}

interface AnalyticsMetrics {
  total_candidates: number
  shortlisted: number
  not_shortlisted: number
  in_process: number
  selected: number
  conversion_rate: number
  rejection_ratio: number
  shortlist_ratio: number
}

export default function AnalysisPage() {
  const navigate = useNavigate()
  const { recruiterId } = useParams()
  const userRole = useAuthStore((s) => s.userRole)
  const baseRole = userRole === 'admin' ? '/admin' : '/user'
  const isAdminRecruiterView = userRole === 'admin' && !!recruiterId
  const isAdminGlobalView = userRole === 'admin' && !recruiterId

  // Fetch recruiter data when in recruiter-level admin view
  const { data: viewedRecruiter } = useQuery({
    queryKey: ['recruiter', recruiterId],
    queryFn: () => recruiterService.getById(recruiterId!),
    enabled: isAdminRecruiterView,
  })

  const { data: recruiters = [] } = useQuery({
    queryKey: ['recruiters'],
    queryFn: recruiterService.listAll,
    enabled: userRole === 'admin',
    retry: 1,
  })

  const [globalSelectedRecruiters, setGlobalSelectedRecruiters] = useState<string[]>([])
  const [globalSelectedClients, setGlobalSelectedClients] = useState<string[]>([])
  const [globalSelectedRoles, setGlobalSelectedRoles] = useState<string[]>([])
  const [globalRecruiterDropdownOpen, setGlobalRecruiterDropdownOpen] = useState(false)
  const [globalClientDropdownOpen, setGlobalClientDropdownOpen] = useState(false)
  const [globalRoleDropdownOpen, setGlobalRoleDropdownOpen] = useState(false)
  const [recruiterDraftSelection, setRecruiterDraftSelection] = useState<string[]>([])
  const [clientDraftSelection, setClientDraftSelection] = useState<string[]>([])
  const [roleDraftSelection, setRoleDraftSelection] = useState<string[]>([])
  const [recruiterSearch, setRecruiterSearch] = useState<string>('')
  const [clientSearch, setClientSearch] = useState<string>('')
  const [roleSearch, setRoleSearch] = useState<string>('')

  const recruiterDropdownRef = useRef<HTMLDivElement | null>(null)
  const clientDropdownRef = useRef<HTMLDivElement | null>(null)
  const roleDropdownRef = useRef<HTMLDivElement | null>(null)

  const [selectedClient, setSelectedClient] = useState<string>('All')
  const [selectedRole, setSelectedRole] = useState<string>('All')
  const [timePeriod, setTimePeriod] = useState<'Weekly' | 'Fortnight' | 'Monthly' | 'Quarterly' | 'Yearly'>('Weekly')

  // Fetch jobs data
  const { data: jobs = [], isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['jobs', userRole === 'admin' ? recruiterId || 'all' : 'me'],
    queryFn: async () => {
      try {
        const result = isAdminRecruiterView && recruiterId
          ? await jobService.listJobsForRecruiter(recruiterId)
          : await jobService.listJobs()
        console.log('Jobs API Response:', result)
        return result || []
      } catch (err) {
        console.error('Jobs API Error:', err)
        throw err
      }
    },
    enabled: userRole === 'admin' ? true : true,
    retry: 1,
  })

  // Fetch candidates data - include filters in query key for reactive updates
  const { data: candidateData = { candidates: [], total: 0 }, isLoading: candidatesLoading, error: candidatesError } = useQuery({
    queryKey: ['candidates', 'all', selectedClient, selectedRole, timePeriod],
    queryFn: async () => {
      try {
        const result = await candidateService.listCandidates({
          page: 1,
          page_size: 1000,
        })
        console.log('Candidates API Response:', result)
        return result || { candidates: [], total: 0 }
      } catch (err) {
        console.error('Candidates API Error:', err)
        throw err
      }
    },
    retry: 1,
  })

  // Log data for debugging
  useEffect(() => {
    console.log('=== Analytics Page Data ===')
    console.log('Jobs:', jobs)
    console.log('Jobs Loading:', jobsLoading, 'Jobs Error:', jobsError)
    console.log('Candidates:', candidateData)
    console.log('Candidates Loading:', candidatesLoading, 'Candidates Error:', candidatesError)
    if (candidatesError) {
      console.error('Candidates Error Details:', candidatesError)
    }
  }, [jobs, candidateData, jobsLoading, jobsError, candidatesLoading, candidatesError])

  const globalRecruiterOptions = useMemo(() => {
    return recruiters.map((recruiter: any) => ({
      id: recruiter.id,
      name: recruiter.user_name || recruiter.email || 'Unknown Recruiter',
    }))
  }, [recruiters])

  const filteredJobsByGlobalRecruiters = useMemo(() => {
    if (!userRole || !jobs.length) return jobs
    if (!isAdminGlobalView) return jobs
    if (globalSelectedRecruiters.length === 0) return jobs
    return jobs.filter((job: any) => globalSelectedRecruiters.includes(job.recruiter_id))
  }, [jobs, userRole, globalSelectedRecruiters])

  const globalClientOptions = useMemo(() => {
    const clientSet = new Set<string>()
    filteredJobsByGlobalRecruiters.forEach((job: any) => {
      const clientName = job.meta?.client_name || 'Unknown'
      clientSet.add(clientName)
    })
    return Array.from(clientSet)
  }, [filteredJobsByGlobalRecruiters])

  const availableGlobalFilterJobs = useMemo(() => {
    let availableJobs = filteredJobsByGlobalRecruiters

    if (isAdminGlobalView && globalSelectedClients.length > 0) {
      availableJobs = availableJobs.filter((job: any) => globalSelectedClients.includes(job.meta?.client_name || 'Unknown'))
    }

    if (isAdminGlobalView && globalSelectedRoles.length > 0) {
      availableJobs = availableJobs.filter((job: any) => {
        const role = job.job_title || job.meta?.session_name?.split(' - ')[1] || 'Unknown'
        return globalSelectedRoles.includes(role)
      })
    }

    return availableJobs
  }, [filteredJobsByGlobalRecruiters, isAdminGlobalView, globalSelectedClients, globalSelectedRoles])

  const globalRoleOptions = useMemo(() => {
    const roleSet = new Set<string>()
    filteredJobsByGlobalRecruiters.forEach((job: any) => {
      const role = job.job_title || job.meta?.session_name?.split(' - ')[1] || 'Unknown'
      roleSet.add(role)
    })
    return Array.from(roleSet)
  }, [filteredJobsByGlobalRecruiters])

  const visibleGlobalRecruiterOptions = useMemo(() => {
    return globalRecruiterOptions.filter((recruiter: any) =>
      recruiter.name.toLowerCase().includes(recruiterSearch.toLowerCase())
    )
  }, [globalRecruiterOptions, recruiterSearch])

  const visibleGlobalClientOptions = useMemo(() => {
    return globalClientOptions.filter((client) =>
      client.toLowerCase().includes(clientSearch.toLowerCase())
    )
  }, [globalClientOptions, clientSearch])

  const visibleGlobalRoleOptions = useMemo(() => {
    return globalRoleOptions.filter((role) =>
      role.toLowerCase().includes(roleSearch.toLowerCase())
    )
  }, [globalRoleOptions, roleSearch])

  const isAllSelected = (selected: string[], allValues: string[]) => {
    return allValues.length > 0 && allValues.every((value) => selected.includes(value))
  }

  const formatRecruiterLabel = () => {
    if (globalSelectedRecruiters.length === 0) return 'Select Recruiters'
    if (globalSelectedRecruiters.length === globalRecruiterOptions.length) return 'All Recruiters'
    if (globalSelectedRecruiters.length === 1) {
      const recruiter = globalRecruiterOptions.find((rec: any) => rec.id === globalSelectedRecruiters[0])
      return recruiter?.name || globalSelectedRecruiters[0]
    }
    return `${globalSelectedRecruiters.length} selected`
  }

  useEffect(() => {
    if (globalSelectedRecruiters.length > 0) {
      setRecruiterDraftSelection(globalSelectedRecruiters)
    }
  }, [globalSelectedRecruiters])

  useEffect(() => {
    if (globalSelectedClients.length > 0) {
      setClientDraftSelection(globalSelectedClients)
    }
  }, [globalSelectedClients])

  useEffect(() => {
    if (globalSelectedRoles.length > 0) {
      setRoleDraftSelection(globalSelectedRoles)
    }
  }, [globalSelectedRoles])

  useEffect(() => {
    if (isAdminGlobalView && recruiters.length > 0 && globalSelectedRecruiters.length === 0) {
      setGlobalSelectedRecruiters(globalRecruiterOptions.map((rec: any) => rec.id))
    }
  }, [isAdminGlobalView, recruiters, globalSelectedRecruiters.length, globalRecruiterOptions])

  useEffect(() => {
    if (!globalRecruiterDropdownOpen) {
      setRecruiterSearch('')
    }
  }, [globalRecruiterDropdownOpen])

  useEffect(() => {
    if (!globalClientDropdownOpen) {
      setClientSearch('')
    }
  }, [globalClientDropdownOpen])

  useEffect(() => {
    if (!globalRoleDropdownOpen) {
      setRoleSearch('')
    }
  }, [globalRoleDropdownOpen])

  useEffect(() => {
    if (isAdminGlobalView && globalClientOptions.length > 0 && globalSelectedClients.length === 0) {
      setGlobalSelectedClients(globalClientOptions)
    }
  }, [isAdminGlobalView, globalClientOptions, globalSelectedClients.length])

  useEffect(() => {
    if (isAdminGlobalView && globalRoleOptions.length > 0 && globalSelectedRoles.length === 0) {
      setGlobalSelectedRoles(globalRoleOptions)
    }
  }, [isAdminGlobalView, globalRoleOptions, globalSelectedRoles.length])

  const clients = useMemo(() => {
    const clientSet = new Set<string>()
    availableGlobalFilterJobs.forEach((job: any) => {
      const clientName = job.meta?.client_name || 'Unknown'
      clientSet.add(clientName)
    })
    return ['All', ...Array.from(clientSet)]
  }, [availableGlobalFilterJobs])

  const rolesForClient = useMemo(() => {
    const roleSet = new Set<string>()
    availableGlobalFilterJobs.forEach((job: any) => {
      const clientName = job.meta?.client_name || 'Unknown'
      if (selectedClient !== 'All' && clientName !== selectedClient) return
      const role = job.job_title || job.meta?.session_name?.split(' - ')[1] || 'Unknown'
      roleSet.add(role)
    })
    return ['All', ...Array.from(roleSet)]
  }, [selectedClient, availableGlobalFilterJobs])

  useEffect(() => {
    if (isAdminGlobalView) {
      if (globalSelectedClients.length === 1) {
        setSelectedClient(globalSelectedClients[0])
      } else if (globalSelectedClients.length > 1 && selectedClient !== 'All' && !globalSelectedClients.includes(selectedClient)) {
        setSelectedClient('All')
      }
    }
  }, [globalSelectedClients, selectedClient, isAdminGlobalView])

  useEffect(() => {
    if (selectedClient !== 'All' && !clients.includes(selectedClient)) {
      setSelectedClient('All')
    }
  }, [clients, selectedClient])

  useEffect(() => {
    if (isAdminGlobalView) {
      if (globalSelectedRoles.length === 1) {
        setSelectedRole(globalSelectedRoles[0])
      } else if (globalSelectedRoles.length > 1 && selectedRole !== 'All' && !globalSelectedRoles.includes(selectedRole)) {
        setSelectedRole('All')
      } else if (globalSelectedRoles.length === 0 && selectedRole !== 'All') {
        setSelectedRole('All')
      }
    }
  }, [globalSelectedRoles, selectedRole, isAdminGlobalView])

  useEffect(() => {
    if (selectedRole !== 'All' && !rolesForClient.includes(selectedRole)) {
      setSelectedRole('All')
    }
  }, [rolesForClient, selectedRole])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recruiterDropdownRef.current && !recruiterDropdownRef.current.contains(event.target as Node)) {
        setGlobalRecruiterDropdownOpen(false)
      }
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setGlobalClientDropdownOpen(false)
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setGlobalRoleDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleGlobalSelection = (
    value: string,
    selected: string[],
    setter: (values: string[]) => void,
    allValues: string[]
  ) => {
    if (value === 'all') {
      if (isAllSelected(selected, allValues)) {
        setter([])
      } else {
        setter(allValues)
      }
      return
    }

    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }

  const formatMultiLabel = (
    selected: string[],
    allValues: string[],
    allLabel: string,
    noneLabel: string
  ) => {
    if (selected.length === 0) return noneLabel
    if (selected.length === allValues.length) return `All ${allLabel}`
    if (selected.length === 1) return selected[0]
    return `${selected.length} selected`
  }

  // Filter candidates based on selected filters
  const filteredCandidates = useMemo(() => {
    try {
      let filtered = candidateData?.candidates || []

      // Global admin filters (only on admin-wide analytics)
      if (isAdminGlobalView) {
        if (globalSelectedRecruiters.length > 0) {
          filtered = filtered.filter((c: any) => {
            if (!c.recruiter_id) return true
            return globalSelectedRecruiters.includes(c.recruiter_id)
          })
        }

        if (globalSelectedClients.length > 0) {
          filtered = filtered.filter((c: any) => globalSelectedClients.includes(c.client_name || 'Unknown'))
        }

        if (globalSelectedRoles.length > 0) {
          filtered = filtered.filter((c: any) => {
            const candidateRole = c.job_role || c.job_applied || 'Unknown'
            return globalSelectedRoles.some((role) =>
              candidateRole.toLowerCase().includes(role.toLowerCase()) ||
              role.toLowerCase().includes(candidateRole.toLowerCase())
            )
          })
        }
      }

      // Page-level filters
      if (selectedClient !== 'All') {
        filtered = filtered.filter((c: any) => (c.client_name || 'Unknown') === selectedClient)
      }

      if (selectedRole !== 'All') {
        filtered = filtered.filter((c: any) => {
          const candidateRole = c.job_role || c.job_applied || 'Unknown'
          return candidateRole.toLowerCase().includes(selectedRole.toLowerCase()) ||
                 selectedRole.toLowerCase().includes(candidateRole.toLowerCase())
        })
      }

      const timePeriodDays: Record<string, number> = {
        'Weekly': 7,
        'Fortnight': 14,
        'Monthly': 30,
        'Quarterly': 90,
        'Yearly': 365,
      }
      const daysAgo = timePeriodDays[timePeriod] || 7
      const now = new Date()
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
      filtered = filtered.filter((c: any) => {
        try {
          return new Date(c.created_at) >= cutoffDate
        } catch {
          return false
        }
      })

      return filtered
    } catch (err) {
      console.error('Error filtering candidates:', err)
      return []
    }
  }, [candidateData?.candidates, globalSelectedRecruiters, globalSelectedClients, globalSelectedRoles, selectedClient, selectedRole, timePeriod, userRole])

  // Calculate metrics
  const metrics = useMemo(() => {
    try {
      const total = filteredCandidates?.length || 0
      const shortlisted = filteredCandidates?.filter((c: any) => c.review_status === 'shortlisted')?.length || 0
      const notShortlisted = filteredCandidates?.filter((c: any) => c.review_status === 'not_shortlisted')?.length || 0
      const inProcess = filteredCandidates?.filter((c: any) => c.review_status === 'in_process')?.length || 0
      const selected = filteredCandidates?.filter((c: any) => c.review_status === 'selected')?.length || 0

      const rejectionRatio = total > 0 ? Math.round((notShortlisted / total) * 100) : 0
      const shortlistRatio = total > 0 ? Math.round((shortlisted / total) * 100) : 0
      return {
        total_candidates: total,
        shortlisted,
        not_shortlisted: notShortlisted,
        in_process: inProcess,
        selected,
        conversion_rate: total > 0 ? Math.round((selected / total) * 100) : 0,
        rejection_ratio: rejectionRatio,
        shortlist_ratio: shortlistRatio,
      }
    } catch (err) {
      console.error('Error calculating metrics:', err)
      return {
        total_candidates: 0,
        shortlisted: 0,
        not_shortlisted: 0,
        in_process: 0,
        selected: 0,
        conversion_rate: 0,
        rejection_ratio: 0,
        shortlist_ratio: 0,
      }
    }
  }, [filteredCandidates])

  // Prepare data for charts
  const statusDistribution = useMemo(() => {
    try {
      return [
        { name: 'Shortlisted', value: metrics.shortlisted, fill: STATUS_COLORS.shortlisted },
        { name: 'Selected', value: metrics.selected, fill: STATUS_COLORS.selected },
        { name: 'In Process', value: metrics.in_process, fill: STATUS_COLORS.in_process },
        { name: 'Not Shortlisted', value: metrics.not_shortlisted, fill: STATUS_COLORS.not_shortlisted },
      ].filter(item => item.value > 0)
    } catch (err) {
      console.error('Error in statusDistribution:', err)
      return []
    }
  }, [metrics])

  const candidatesByRole = useMemo(() => {
    try {
      const roleMap: Record<string, number> = {}
      filteredCandidates.forEach((c: any) => {
        const role = c.job_role || c.job_applied || 'Unknown'
        roleMap[role] = (roleMap[role] || 0) + 1
      })
      return Object.entries(roleMap).map(([name, value]) => ({ name, value }))
    } catch (err) {
      console.error('Error in candidatesByRole:', err)
      return []
    }
  }, [filteredCandidates])

  const candidatesByClient = useMemo(() => {
    try {
      const clientMap: Record<string, number> = {}
      filteredCandidates.forEach((c: any) => {
        const client = c.client_name || 'Unknown'
        clientMap[client] = (clientMap[client] || 0) + 1
      })
      return Object.entries(clientMap).map(([name, value]) => ({ name, value }))
    } catch (err) {
      console.error('Error in candidatesByClient:', err)
      return []
    }
  }, [filteredCandidates])

  const trendData = useMemo(() => {
    try {
      const dayMap: Record<string, any> = {}
      filteredCandidates.forEach((c: any) => {
        try {
          const dateStr = c.created_at
          if (!dateStr) return
          const date = new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
          if (!dayMap[date]) {
            dayMap[date] = { date, total: 0, shortlisted: 0, selected: 0 }
          }
          dayMap[date].total += 1
          if (c.review_status === 'shortlisted') dayMap[date].shortlisted += 1
          if (c.review_status === 'selected') dayMap[date].selected += 1
        } catch (err) {
          console.error('Error processing candidate date:', c, err)
        }
      })
      return Object.values(dayMap).slice(-14) // Last 14 days
    } catch (err) {
      console.error('Error in trendData:', err)
      return []
    }
  }, [filteredCandidates])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Fixed Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(`${baseRole}/dashboard`)} 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  Analytics Dashboard
                </h1>
                <p className="text-sm text-gray-500 mt-1">Real-time recruitment pipeline insights and performance metrics</p>
              </div>
            </div>
            <button className="btn-primary flex items-center gap-2 px-4 py-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          {(jobsLoading || candidatesLoading) && (
            <div className="text-sm text-gray-500">Loading analytics...</div>
          )}
          {jobsError && (
            <div className="text-sm text-red-600">Error loading jobs: {jobsError?.message || 'Unknown error'}</div>
          )}
          {candidatesError && (
            <div className="text-sm text-red-600">
              Error loading candidates: {(candidatesError as any)?.message || JSON.stringify(candidatesError)}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-6">
        {isAdminGlobalView && (
          <Card padding="lg" className="mb-6 border-0 shadow-md">
            <div className="flex items-center gap-3 mb-5">
              <Filter className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-gray-900 text-lg">Global Filters</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="relative" ref={recruiterDropdownRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Recruiter</label>
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = !globalRecruiterDropdownOpen
                    setGlobalRecruiterDropdownOpen(nextOpen)
                    if (nextOpen) {
                      setRecruiterDraftSelection(globalSelectedRecruiters.length ? globalSelectedRecruiters : globalRecruiterOptions.map((rec: any) => rec.id))
                    }
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm hover:border-indigo-300 transition-all"
                >
                  {formatRecruiterLabel()}
                </button>
                {globalRecruiterDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-lg">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <input
                        type="text"
                        value={recruiterSearch}
                        onChange={(e) => setRecruiterSearch(e.target.value)}
                        placeholder="Search recruiters..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                      onClick={() => toggleGlobalSelection('all', recruiterDraftSelection, setRecruiterDraftSelection, visibleGlobalRecruiterOptions.map((rec: any) => rec.id))}
                    >
                      {isAllSelected(recruiterDraftSelection, visibleGlobalRecruiterOptions.map((rec: any) => rec.id)) ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="max-h-64 overflow-y-auto">
                      {visibleGlobalRecruiterOptions.map((recruiter: any) => (
                        <button
                          key={recruiter.id}
                          type="button"
                          className={`w-full px-4 py-3 text-left text-sm transition-colors ${recruiterDraftSelection.includes(recruiter.id) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
                          onClick={() => toggleGlobalSelection(recruiter.id, recruiterDraftSelection, setRecruiterDraftSelection, globalRecruiterOptions.map((rec: any) => rec.id))}
                        >
                          <span className={`inline-flex h-4 w-4 items-center justify-center rounded border border-gray-300 mr-2 ${recruiterDraftSelection.includes(recruiter.id) ? 'bg-indigo-600 text-white' : 'bg-white text-transparent'}`}>
                            ✓
                          </span>
                          {recruiter.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
                      <button
                        type="button"
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setRecruiterDraftSelection(globalSelectedRecruiters)
                          setGlobalRecruiterDropdownOpen(false)
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        onClick={() => {
                          setGlobalSelectedRecruiters(recruiterDraftSelection)
                          setGlobalRecruiterDropdownOpen(false)
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={clientDropdownRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Client</label>
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = !globalClientDropdownOpen
                    setGlobalClientDropdownOpen(nextOpen)
                    if (nextOpen) {
                      setClientDraftSelection(globalSelectedClients.length ? globalSelectedClients : globalClientOptions)
                    }
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm hover:border-indigo-300 transition-all"
                >
                  {formatMultiLabel(globalSelectedClients, globalClientOptions, 'Clients', 'Select Clients')}
                </button>
                {globalClientDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-lg">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search clients..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                      onClick={() => toggleGlobalSelection('all', clientDraftSelection, setClientDraftSelection, visibleGlobalClientOptions)}
                    >
                      {isAllSelected(clientDraftSelection, visibleGlobalClientOptions) ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="max-h-64 overflow-y-auto">
                      {visibleGlobalClientOptions.map((client) => (
                        <button
                          key={client}
                          type="button"
                          className={`w-full px-4 py-3 text-left text-sm transition-colors ${clientDraftSelection.includes(client) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
                          onClick={() => toggleGlobalSelection(client, clientDraftSelection, setClientDraftSelection, globalClientOptions)}
                        >
                          <span className={`inline-flex h-4 w-4 items-center justify-center rounded border border-gray-300 mr-2 ${clientDraftSelection.includes(client) ? 'bg-indigo-600 text-white' : 'bg-white text-transparent'}`}>
                            ✓
                          </span>
                          {client}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
                      <button
                        type="button"
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setClientDraftSelection(globalSelectedClients)
                          setGlobalClientDropdownOpen(false)
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        onClick={() => {
                          setGlobalSelectedClients(clientDraftSelection)
                          setGlobalClientDropdownOpen(false)
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={roleDropdownRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Job Role</label>
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = !globalRoleDropdownOpen
                    setGlobalRoleDropdownOpen(nextOpen)
                    if (nextOpen) {
                      setRoleDraftSelection(globalSelectedRoles.length ? globalSelectedRoles : globalRoleOptions)
                    }
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm hover:border-indigo-300 transition-all"
                >
                  {formatMultiLabel(globalSelectedRoles, globalRoleOptions, 'Job Roles', 'Select Job Roles')}
                </button>
                {globalRoleDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-lg">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <input
                        type="text"
                        value={roleSearch}
                        onChange={(e) => setRoleSearch(e.target.value)}
                        placeholder="Search roles..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                      onClick={() => toggleGlobalSelection('all', roleDraftSelection, setRoleDraftSelection, visibleGlobalRoleOptions)}
                    >
                      {isAllSelected(roleDraftSelection, visibleGlobalRoleOptions) ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="max-h-64 overflow-y-auto">
                      {visibleGlobalRoleOptions.map((role) => (
                        <button
                          key={role}
                          type="button"
                          className={`w-full px-4 py-3 text-left text-sm transition-colors ${roleDraftSelection.includes(role) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
                          onClick={() => toggleGlobalSelection(role, roleDraftSelection, setRoleDraftSelection, globalRoleOptions)}
                        >
                          <span className={`inline-flex h-4 w-4 items-center justify-center rounded border border-gray-300 mr-2 ${roleDraftSelection.includes(role) ? 'bg-indigo-600 text-white' : 'bg-white text-transparent'}`}>
                            ✓
                          </span>
                          {role}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
                      <button
                        type="button"
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setRoleDraftSelection(globalSelectedRoles)
                          setGlobalRoleDropdownOpen(false)
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        onClick={() => {
                          setGlobalSelectedRoles(roleDraftSelection)
                          setGlobalRoleDropdownOpen(false)
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Global filters control the full analytics dashboard. Use page-level filters below for additional refinement.
            </p>
          </Card>
        )}

        {/* Filters Section */}
        <Card padding="lg" className="mb-6 border-0 shadow-md">
          <div className="flex items-center gap-3 mb-5">
            <Filter className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-gray-900 text-lg">Filter Analytics</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Client</label>
              <select
                value={selectedClient}
                onChange={(e) => {
                  setSelectedClient(e.target.value)
                  setSelectedRole('All')
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 transition-all"
              >
                {clients.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Job Role</label>
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value)} 
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 transition-all"
              >
                {rolesForClient.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Time Period</label>
              <select 
                value={timePeriod} 
                onChange={(e) => setTimePeriod(e.target.value as 'Weekly' | 'Fortnight' | 'Monthly' | 'Quarterly' | 'Yearly')} 
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 transition-all"
              >
                <option value="Weekly">Weekly</option>
                <option value="Fortnight">Fortnight</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Executive Summary - KPI Cards */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Key Performance Indicators
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Candidates',
                value: metrics.total_candidates,
                icon: Users,
                color: 'from-violet-500 to-violet-600',
                bgColor: 'bg-violet-50',
                borderColor: 'border-violet-200',
                trend: '+12%',
                trendPositive: true,
              },
              {
                label: 'Shortlist Ratio',
                value: `${metrics.shortlist_ratio}%`,
                icon: TrendingUp,
                color: 'from-amber-500 to-amber-600',
                bgColor: 'bg-amber-50',
                borderColor: 'border-amber-200',
                trend: metrics.total_candidates > 0 ? '+1.2%' : 'N/A',
                trendPositive: true,
              },             
              {
                label: 'Conversion Rate',
                value: `${metrics.conversion_rate}%`,
                icon: TrendingUp,
                color: 'from-amber-500 to-amber-600',
                bgColor: 'bg-amber-50',
                borderColor: 'border-amber-200',
                trend: metrics.total_candidates > 0 ? '+2.5%' : 'N/A',
                trendPositive: true,
              },
              {
                label: 'Rejection Ratio',
                value: `${metrics.rejection_ratio}%`,
                icon: Zap,
                color: 'from-red-500 to-rose-500',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                trend: metrics.total_candidates > 0 ? '+1.2%' : 'N/A',
                trendPositive: false,
              }
            ].map(({ label, value, icon: Icon, color, bgColor, borderColor, trend, trendPositive }) => (
              <Card key={label} padding="md" className={`border-2 ${borderColor} shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                    <p className={`text-xs font-semibold mt-2 ${trendPositive ? 'text-emerald-600' : 'text-red-600'} flex items-center gap-1`}>
                      <TrendingUp className="w-3 h-3" />
                      {trend} from last period
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} p-2 text-white shadow-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Candidate Pipeline Status
          </h2>
          <Card padding="lg" className="border-0 shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { status: 'In Process', count: metrics.in_process, color: 'from-amber-500 to-orange-500', icon: Clock },
                { status: 'Shortlisted', count: metrics.shortlisted, color: 'from-emerald-500 to-teal-500', icon: CheckCircle2 },
                { status: 'Selected', count: metrics.selected, color: 'from-blue-500 to-cyan-500', icon: Target },
                { status: 'Not Shortlisted', count: metrics.not_shortlisted, color: 'from-red-500 to-rose-500', icon: Users },
              ].map(({ status, count, color, icon: Icon }) => (
                <div key={status} className={`p-4 rounded-xl bg-gradient-to-br ${color} bg-opacity-10 border-l-4 border-gradient-to-b`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">{status}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                    </div>
                    <Icon className="w-8 h-8 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Status Distribution Pie Chart */}
          <Card padding="lg" className="border-0 shadow-md">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Status Distribution</h3>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-gray-400">
                <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
                <p>No data available</p>
              </div>
            )}
          </Card>

          {/* Candidates by Role Bar Chart */}
          <Card padding="lg" className="border-0 shadow-md">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Candidates by Job Role</h3>
            {candidatesByRole.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={candidatesByRole} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }} 
                  />
                  <Bar dataKey="value" fill="url(#colorBar)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-gray-400">
                <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
                <p>No data available</p>
              </div>
            )}
          </Card>
        </div>

        {/* Additional Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Candidates by Client Bar Chart */}
          <Card padding="lg" className="border-0 shadow-md">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Candidates by Client</h3>
            {candidatesByClient.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={candidatesByClient} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorClient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }} 
                  />
                  <Bar dataKey="value" fill="url(#colorClient)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-gray-400">
                <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
                <p>No data available</p>
              </div>
            )}
          </Card>

          {/* Trend Area Chart */}
          <Card padding="lg" className="border-0 shadow-md">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Recruitment Trends</h3>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    cursor={{ strokeDasharray: '3 3' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#colorTotal)"
                    name="Total Applications"
                  />
                  <Line
                    type="monotone"
                    dataKey="shortlisted"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Shortlisted"
                  />
                  <Line
                    type="monotone"
                    dataKey="selected"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Selected"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-gray-400">
                <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
                <p>No data available</p>
              </div>
            )}
          </Card>
        </div>

        {/* Summary Statistics Table */}
        <Card padding="lg" className="border-0 shadow-md">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Summary Statistics</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Metric</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Value</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Percentage</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">Shortlisted Candidates</td>
                  <td className="text-right py-3 px-4 font-semibold text-indigo-600">{metrics.shortlisted}</td>
                  <td className="text-right py-3 px-4 font-semibold text-indigo-600">
                    {metrics.total_candidates > 0 ? ((metrics.shortlisted / metrics.total_candidates) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="py-3 px-4"><span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Active</span></td>
                </tr>
                <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">In Process Candidates</td>
                  <td className="text-right py-3 px-4 font-semibold text-amber-600">{metrics.in_process}</td>
                  <td className="text-right py-3 px-4 font-semibold text-amber-600">
                    {metrics.total_candidates > 0 ? ((metrics.in_process / metrics.total_candidates) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="py-3 px-4"><span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Pending</span></td>
                </tr>
                <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">Selected Candidates</td>
                  <td className="text-right py-3 px-4 font-semibold text-blue-600">{metrics.selected}</td>
                  <td className="text-right py-3 px-4 font-semibold text-blue-600">
                    {metrics.total_candidates > 0 ? ((metrics.selected / metrics.total_candidates) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="py-3 px-4"><span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Success</span></td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">Not Shortlisted Candidates</td>
                  <td className="text-right py-3 px-4 font-semibold text-red-600">{metrics.not_shortlisted}</td>
                  <td className="text-right py-3 px-4 font-semibold text-red-600">
                    {metrics.total_candidates > 0 ? ((metrics.not_shortlisted / metrics.total_candidates) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="py-3 px-4"><span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Rejected</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Footer spacing */}
        <div className="h-8" />
      </div>
    </div>
  )
}
