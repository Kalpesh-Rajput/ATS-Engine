import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, MoreVertical, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'

interface User {
  id: string
  user_name: string
  email: string
  is_admin: boolean
  is_active: boolean
  total_resumes_uploaded: number
  total_shortlisted: number
  created_at: string
  last_active: string
}

export default function UserPerformancePage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'recruiters' | 'admins'>('all')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      // Mock data - replace with actual API call
      return [
        {
          id: '1',
          user_name: 'Alice Johnson',
          email: 'alice@company.com',
          is_admin: false,
          is_active: true,
          total_resumes_uploaded: 156,
          total_shortlisted: 42,
          created_at: '2025-01-15',
          last_active: '2026-04-05',
        },
        {
          id: '2',
          user_name: 'Bob Smith',
          email: 'bob@company.com',
          is_admin: false,
          is_active: true,
          total_resumes_uploaded: 203,
          total_shortlisted: 58,
          created_at: '2025-02-20',
          last_active: '2026-04-04',
        },
        {
          id: '3',
          user_name: 'Charlie Admin',
          email: 'charlie@company.com',
          is_admin: true,
          is_active: true,
          total_resumes_uploaded: 0,
          total_shortlisted: 0,
          created_at: '2024-12-01',
          last_active: '2026-04-05',
        },
      ]
    },
  })

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterType === 'recruiters') return matchesSearch && !user.is_admin
    if (filterType === 'admins') return matchesSearch && user.is_admin
    return matchesSearch
  })

  const getShortlistRate = (uploaded: number, shortlisted: number) => {
    if (uploaded === 0) return 0
    return ((shortlisted / uploaded) * 100).toFixed(1)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">User Performance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Monitor recruiter activity and performance metrics</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="input pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'recruiters', 'admins'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <p className="text-slate-500">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">User</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Resumes</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Shortlisted</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Last Active</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map(user => {
                  const rate = getShortlistRate(user.total_resumes_uploaded, user.total_shortlisted)
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{user.user_name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_admin
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.is_admin ? 'Admin' : 'Recruiter'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-slate-900">{user.total_resumes_uploaded}</span>
                          <TrendingUp className="w-3 h-3 text-green-600" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">{user.total_shortlisted}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-slate-900">{rate}%</span>
                          {Number(rate) > 25 ? (
                            <ArrowUpRight className="w-4 h-4 text-green-600" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-orange-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{formatDate(user.last_active)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-slate-600">Total Recruiters</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {filteredUsers.filter(u => !u.is_admin).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-600">Total Admins</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {filteredUsers.filter(u => u.is_admin).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-600">Active Users</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {filteredUsers.filter(u => u.is_active).length}
          </p>
        </div>
      </div>
    </div>
  )
}
