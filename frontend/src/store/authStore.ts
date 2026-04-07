import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Recruiter {
  id: string
  user_name: string
  email: string
  is_admin: boolean
  total_resumes_uploaded: number
  total_shortlisted: number
}

type UserRole = 'user' | 'admin'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  recruiter: Recruiter | null
  userRole: UserRole | null
  setTokens: (access: string, refresh: string) => void
  setRecruiter: (r: Recruiter) => void
  setUserRole: (role: UserRole) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      recruiter: null,
      userRole: null,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setRecruiter: (recruiter) => set({ recruiter }),

      setUserRole: (userRole) => set({ userRole }),

      logout: () =>
        set({ 
          accessToken: null, 
          refreshToken: null, 
          recruiter: null,
          userRole: null 
        }),
    }),
    { name: 'ats-auth' }
  )
)
