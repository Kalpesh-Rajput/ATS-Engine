import { api } from './api'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }).then((r) => r.data),
}

// ─── Recruiter ────────────────────────────────────────────────────────────────
export const recruiterService = {
  getMe: () => api.get('/recruiters/me').then((r) => r.data),
  getStats: () => api.get('/recruiters/me/stats').then((r) => r.data),
  updateMe: (data: { user_name?: string; email?: string }) =>
    api.put('/recruiters/me', data).then((r) => r.data),

  // Admin only
  listAll: () => api.get('/recruiters/').then((r) => r.data),
  createRecruiter: (data: { user_name: string; email: string; password: string }) =>
    api.post('/recruiters/', data).then((r) => r.data),
  deleteRecruiter: (id: string) => api.delete(`/recruiters/${id}`),
}

// ─── Uploads ──────────────────────────────────────────────────────────────────
export const uploadService = {
  uploadJob: (formData: FormData) =>
    api.post('/uploads/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobService = {
  listJobs: () => api.get('/jobs/').then((r) => r.data),
  getJob: (id: string) => api.get(`/jobs/${id}`).then((r) => r.data),
  getJobStatus: (id: string) => api.get(`/jobs/${id}/status`).then((r) => r.data),
  addCandidates: (jobId: string, formData: FormData) =>
    api
      .post(`/jobs/${jobId}/add-candidates`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
}

// ─── Candidates ───────────────────────────────────────────────────────────────
export const candidateService = {
  listCandidates: (params?: {
    job_id?: string
    status?: string
    min_score?: number
    page?: number
    page_size?: number
  }) => api.get('/candidates/', { params }).then((r) => r.data),

  getCandidate: (id: string) => api.get(`/candidates/${id}`).then((r) => r.data),

  shortlist: (candidateIds: string[]) =>
    api.post('/candidates/shortlist', { candidate_ids: candidateIds }).then((r) => r.data),

  deleteCandidate: (id: string) => api.delete(`/candidates/${id}`),
}
