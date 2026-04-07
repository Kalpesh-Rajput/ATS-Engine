import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail, Lock, ArrowLeft, Shield } from 'lucide-react'
import { authService, recruiterService } from '../services/apiServices'
import { useAuthStore } from '../store/authStore'
import { Input } from '../components/common/Input'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setRecruiter, setUserRole } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [role, setRoleLocal] = useState<'recruiter' | 'admin'>('recruiter')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const tokens = await authService.login(email, password)
      setTokens(tokens.access_token, tokens.refresh_token)
      const me = await recruiterService.getMe()

      if (role === 'admin' && !me.is_admin) {
        throw new Error('This account is not an admin account')
      }

      setRecruiter(me)
      if (role === 'admin') {
        setUserRole('admin')
        navigate('/admin/dashboard')
      } else {
        setUserRole('user')
        navigate('/user/dashboard')
      }
      toast.success('Welcome back!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center gradient-hero p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary-100/80 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary-50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <Card padding="lg" className="border-gray-200/90 shadow-soft-lg ring-1 ring-black/5 animate-scale-in">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-lg shadow-primary-500/25 ring-1 ring-white/20">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Sign in</h1>
            <p className="mt-2 text-sm text-gray-500">ATS Engine — recruitment workspace</p>
          </div>

          <div className="mb-6">
            <p className="label">Sign in as</p>
            <div className="flex gap-1 rounded-xl border border-gray-200/90 bg-gray-50/80 p-1 ring-1 ring-black/[0.03]">
              <button
                type="button"
                onClick={() => setRoleLocal('recruiter')}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                  role === 'recruiter'
                    ? 'bg-primary-100 text-primary-900 ring-1 ring-primary-300'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Recruiter
              </button>
              <button
                type="button"
                onClick={() => setRoleLocal('admin')}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                  role === 'admin'
                    ? 'bg-primary-100 text-primary-900 ring-1 ring-primary-300'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              leftIcon={<Mail className="h-4 w-4" />}
            />

            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              leftIcon={<Lock className="h-4 w-4" />}
            />

            <Button type="submit" variant="primary" className="w-full btn-lg" isLoading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-gray-200/90 bg-gray-50/80 px-4 py-3.5">
            <div className="flex gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden />
              <p className="text-xs leading-relaxed text-gray-600">
                Use credentials issued by your administrator. If you need access or a password reset, contact your
                team lead or IT.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
