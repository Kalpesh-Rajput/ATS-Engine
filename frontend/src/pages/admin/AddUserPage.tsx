import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2, ArrowLeft, Mail, User, Lock, Shield } from 'lucide-react'

export default function AddUserPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [userType, setUserType] = useState<'recruiter' | 'admin'>('recruiter')
  const [formData, setFormData] = useState({
    user_name: '',
    email: '',
    password: '',
    confirm_password: '',
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      // API call to create user would go here
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: formData.user_name,
          email: formData.email,
          password: formData.password,
          is_admin: userType === 'admin',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create user')
      }

      toast.success(`${userType === 'admin' ? 'Admin' : 'Recruiter'} created successfully`)
      navigate('/admin/users')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <button
        onClick={() => navigate('/admin/dashboard')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="max-w-lg mx-auto">
        <div className="card p-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Create New User</h1>
            <p className="text-slate-500 text-sm mt-1">Add a new recruiter or admin to the platform</p>
          </div>

          {/* User Type Toggle */}
          <div>
            <label className="label mb-3">User Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUserType('recruiter')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  userType === 'recruiter'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <User className="w-4 h-4" />
                Recruiter
              </button>
              <button
                type="button"
                onClick={() => setUserType('admin')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  userType === 'admin'
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="user_name"
                  className="input pl-9"
                  placeholder="John Doe"
                  value={formData.user_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  className="input pl-9"
                  placeholder="john@company.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  name="confirm_password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={formData.confirm_password}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center py-2.5"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Creating user...' : `Create ${userType === 'admin' ? 'Admin' : 'Recruiter'}`}
            </button>
          </form>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> The user will receive an email with their credentials. They can change their password on first login.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
