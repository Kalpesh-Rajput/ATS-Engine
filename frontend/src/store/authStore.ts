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

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  recruiter: Recruiter | null
  setTokens: (access: string, refresh: string) => void
  setRecruiter: (r: Recruiter) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      recruiter: null,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setRecruiter: (recruiter) => set({ recruiter }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, recruiter: null }),
    }),
    { name: 'ats-auth' }
  )
)
