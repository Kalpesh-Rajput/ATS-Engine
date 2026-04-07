import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { ArrowLeft, Filter, TrendingUp, Users, CheckCircle2, Clock } from 'lucide-react'
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
}

export default function AnalysisPage() {
  const navigate = useNavigate()
  const { recruiterId } = useParams()
  const userRole = useAuthStore((s) => s.userRole)
  const baseRole = userRole === 'admin' ? '/admin' : '/user'
  const isAdminView = userRole === 'admin' && !!recruiterId

  // Fetch recruiter data when in admin view
  const { data: viewedRecruiter } = useQuery({
    queryKey: ['recruiter', recruiterId],
    queryFn: () => recruiterService.getById(recruiterId!),
    enabled: isAdminView,
  })

  const [selectedClient, setSelectedClient] = useState<string>('All')
  const [selectedRole, setSelectedRole] = useState<string>('All')
  const [timePeriod, setTimePeriod] = useState<'7days' | '30days' | 'all'>('30days')

  // Fetch jobs data
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', isAdminView ? recruiterId : 'me'],
    queryFn: () =>
      isAdminView && recruiterId
        ? jobService.listJobsForRecruiter(recruiterId)
        : jobService.listJobs(),
    enabled: isAdminView ? !!recruiterId : true,
  })

  // Fetch candidates data - include filters in query key for reactive updates
  const { data: candidateData = { candidates: [], total: 0 } } = useQuery({
    queryKey: ['candidates', 'all', selectedClient, selectedRole, timePeriod],
    queryFn: () =>
      candidateService.listCandidates({
        page: 1,
        page_size: 1000,
      }),
  })

  const clients = useMemo(() => {
    const clientSet = new Set<string>()
    jobs.forEach((job: any) => {
      const clientName = job.meta?.client_name || 'Unknown'
      clientSet.add(clientName)
    })
    return ['All', ...Array.from(clientSet)]
  }, [jobs])

  const rolesForClient = useMemo(() => {
    const roleSet = new Set<string>()
    jobs.forEach((job: any) => {
      const clientName = job.meta?.client_name || 'Unknown'
      if (selectedClient !== 'All' && clientName !== selectedClient) return
      const role = job.job_title || job.meta?.session_name?.split(' - ')[1] || 'Unknown'
      roleSet.add(role)
    })
    return ['All', ...Array.from(roleSet)]
  }, [selectedClient, jobs])

  // Filter candidates based on selected filters
  const filteredCandidates = useMemo(() => {
    let filtered = candidateData.candidates || []

    // Filter by client
    if (selectedClient !== 'All') {
      filtered = filtered.filter((c: any) => (c.client_name || 'Unknown') === selectedClient)
    }

    // Filter by role
    if (selectedRole !== 'All') {
      filtered = filtered.filter((c: any) => {
        const candidateRole = c.job_role || c.job_applied || 'Unknown'
        return candidateRole.toLowerCase().includes(selectedRole.toLowerCase()) ||
               selectedRole.toLowerCase().includes(candidateRole.toLowerCase())
      })
    }

    // Filter by time period
    if (timePeriod !== 'all') {
      const now = new Date()
      const daysAgo = timePeriod === '7days' ? 7 : 30
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
      filtered = filtered.filter((c: any) => new Date(c.created_at) >= cutoffDate)
    }

    return filtered
  }, [candidateData.candidates, selectedClient, selectedRole, timePeriod])

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = filteredCandidates.length
    const shortlisted = filteredCandidates.filter((c: any) => c.review_status === 'shortlisted').length
    const notShortlisted = filteredCandidates.filter((c: any) => c.review_status === 'not_shortlisted').length
    const inProcess = filteredCandidates.filter((c: any) => c.review_status === 'in_process').length
    const selected = filteredCandidates.filter((c: any) => c.review_status === 'selected').length

    return {
      total_candidates: total,
      shortlisted,
      not_shortlisted: notShortlisted,
      in_process: inProcess,
      selected,
      conversion_rate: total > 0 ? Math.round((selected / total) * 100) : 0,
    }
  }, [filteredCandidates])

  // Prepare data for charts
  const statusDistribution = useMemo(() => [
    { name: 'Shortlisted', value: metrics.shortlisted, fill: STATUS_COLORS.shortlisted },
    { name: 'Selected', value: metrics.selected, fill: STATUS_COLORS.selected },
    { name: 'In Process', value: metrics.in_process, fill: STATUS_COLORS.in_process },
    { name: 'Not Shortlisted', value: metrics.not_shortlisted, fill: STATUS_COLORS.not_shortlisted },
  ].filter(item => item.value > 0), [metrics])

  const candidatesByRole = useMemo(() => {
    const roleMap: Record<string, number> = {}
    filteredCandidates.forEach((c: any) => {
      const role = c.job_role || c.job_applied || 'Unknown'
      roleMap[role] = (roleMap[role] || 0) + 1
    })
    return Object.entries(roleMap).map(([name, value]) => ({ name, value }))
  }, [filteredCandidates])

  const candidatesByClient = useMemo(() => {
    const clientMap: Record<string, number> = {}
    filteredCandidates.forEach((c: any) => {
      const client = c.client_name || 'Unknown'
      clientMap[client] = (clientMap[client] || 0) + 1
    })
    return Object.entries(clientMap).map(([name, value]) => ({ name, value }))
  }, [filteredCandidates])

  const trendData = useMemo(() => {
    const dayMap: Record<string, any> = {}
    filteredCandidates.forEach((c: any) => {
      const date = new Date(c.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      if (!dayMap[date]) {
        dayMap[date] = { date, total: 0, shortlisted: 0, selected: 0 }
      }
      dayMap[date].total += 1
      if (c.review_status === 'shortlisted') dayMap[date].shortlisted += 1
      if (c.review_status === 'selected') dayMap[date].selected += 1
    })
    return Object.values(dayMap).slice(-14) // Last 14 days
  }, [filteredCandidates])

  const kpiCards = [
    {
      label: 'Total Candidates',
      value: metrics.total_candidates,
      icon: Users,
      color: 'from-violet-500 to-violet-600',
      bgColor: 'bg-violet-50',
    },
    {
      label: 'Shortlisted',
      value: metrics.shortlisted,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Selected',
      value: metrics.selected,
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Conversion Rate',
      value: `${metrics.conversion_rate}%`,
      icon: TrendingUp,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
    },
  ]

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`${baseRole}/dashboard`)} className="btn-ghost p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">Performance insights and trends</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {/* Filters - Compact */}
        <Card padding="md" className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Client</label>
              <select
                value={selectedClient}
                onChange={(e) => {
                  setSelectedClient(e.target.value)
                  setSelectedRole('All')
                }}
                className="input"
              >
                {clients.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Job Role</label>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="input">
                {rolesForClient.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Time Period</label>
              <select value={timePeriod} onChange={(e) => setTimePeriod(e.target.value as any)} className="input">
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </Card>

        {/* KPI Cards */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map(({ label, value, icon: Icon, color, bgColor }) => (
            <div
              key={label}
              className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 h-24 flex flex-col justify-between`}
            >
              <div className={`absolute inset-0 ${bgColor} opacity-5 rounded-2xl`} />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className="relative z-10 flex justify-end">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} p-1.5 text-white shadow-md flex items-center justify-center`}>
                  <Icon className="w-full h-full" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Status Distribution Pie Chart */}
          <Card padding="md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                <p>No data available</p>
              </div>
            )}
          </Card>

          {/* Candidates by Role Bar Chart */}
          <Card padding="md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidates by Job Role</h3>
            {candidatesByRole.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={candidatesByRole}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                <p>No data available</p>
              </div>
            )}
          </Card>
        </div>

        {/* More Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Candidates by Client Bar Chart */}
          <Card padding="md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidates by Client</h3>
            {candidatesByClient.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={candidatesByClient}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }} />
                  <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                <p>No data available</p>
              </div>
            )}
          </Card>

          {/* Trend Line Chart */}
          <Card padding="md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidate Trends</h3>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total Applications"
                  />
                  <Line
                    type="monotone"
                    dataKey="shortlisted"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Shortlisted"
                  />
                  <Line
                    type="monotone"
                    dataKey="selected"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Selected"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">
                <p>No data available</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
