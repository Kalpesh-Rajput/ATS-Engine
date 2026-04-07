import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut, Plus } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { jobService } from '../../services/apiServices'
import clsx from 'clsx'

export default function Layout() {
  const { recruiter, userRole, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const baseRole = userRole === 'admin' ? '/admin' : '/user'

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobService.listJobs(),
    enabled: userRole !== 'admin',
    refetchInterval: 10000,
  })

  const recruiterNavItems = [
    { to: `${baseRole}/dashboard`, icon: LayoutDashboard, label: 'Dashboard' },
    { to: `${baseRole}/upload`, icon: Plus, label: 'New Session' },
  ]

  const adminNavItems = [
    { to: `${baseRole}/dashboard`, icon: LayoutDashboard, label: 'Dashboard' },
    { to: `${baseRole}/add-recruiter`, icon: Plus, label: 'Add Recruiter' },
  ]

  const navItems = userRole === 'admin' ? adminNavItems : recruiterNavItems

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="flex w-[17.5rem] shrink-0 flex-col overflow-hidden border-r border-gray-200/90 bg-white shadow-[1px_0_0_rgba(15,23,42,0.04)]">
        <div className="border-b border-gray-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-md shadow-primary-500/20">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight text-gray-900">ATS Engine</p>
              <span
                className={clsx(
                  'mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                  userRole === 'admin'
                    ? 'bg-primary-50 text-primary-800 ring-1 ring-primary-200/80'
                    : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200/80'
                )}
              >
                {userRole === 'admin' ? 'Admin' : 'Recruiter'}
              </span>
            </div>
          </div>
        </div>

        <nav className="shrink-0 space-y-1 px-3 py-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-50 text-primary-900 shadow-sm ring-1 ring-primary-200/70'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
              {label}
            </NavLink>
          ))}
        </nav>

        {userRole !== 'admin' && (
          <div className="flex min-h-0 flex-1 flex-col border-t border-gray-100 px-3 py-4">
            <div className="mb-3 shrink-0 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Sessions</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{jobs.length}</p>
            </div>
            <div className="sidebar-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
              {jobs.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-gray-500">No sessions yet</p>
              ) : (
                jobs.map((job: any) => {
                  const clientName = job.meta?.client_name || 'Unknown'
                  const roleName = job.job_title || 'Unknown'
                  const isActive = location.pathname.includes(`/jobs/${job.id}`)

                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => navigate(`${baseRole}/jobs/${job.id}`)}
                      className={clsx(
                        'w-full rounded-lg border px-3 py-2.5 text-left text-xs transition-all duration-200',
                        isActive
                          ? 'border-primary-200 bg-primary-50/90 text-gray-900 shadow-sm ring-1 ring-primary-200/60'
                          : 'border-transparent bg-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      <p className="truncate font-medium text-gray-900">{clientName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-gray-500">{roleName}</p>
                      <p className="mt-1 text-[11px] text-gray-400 tabular-nums">{job.total_candidates} candidates</p>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white shadow-sm ring-2 ring-white">
              {recruiter?.user_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{recruiter?.user_name}</p>
              <p className="truncate text-xs text-gray-500">{recruiter?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.99]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="h-screen min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
