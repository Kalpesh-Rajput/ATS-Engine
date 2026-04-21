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
  // Admin: get stats for specific recruiter
  getStatsForRecruiter: (id: string) => api.get(`/recruiters/${id}/stats`).then((r) => r.data),
  updateMe: (data: { user_name?: string; email?: string }) =>
    api.put('/recruiters/me', data).then((r) => r.data),

  // Admin only
  listAll: () => api.get('/recruiters/').then((r) => r.data),
  getById: (id: string) => api.get(`/recruiters/${id}`).then((r) => r.data),
  createRecruiter: (data: { user_name: string; email: string; password: string }) =>
    api.post('/recruiters/', data).then((r) => r.data),

  updateRecruiter: (id: string, data: { user_name?: string; email?: string }) =>
    api.put(`/recruiters/${id}`, data).then((r) => r.data),

  deleteRecruiter: (id: string) => api.delete(`/recruiters/${id}`),
}

// ─── Uploads ──────────────────────────────────────────────────────────────────
export const uploadService = {
  uploadJob: (formData: FormData) =>
    api.post('/uploads/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  listAllUploads: () => api.get('/jobs/').then((r) => r.data),
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobService = {
  listJobs: () => api.get('/jobs/').then((r) => r.data),

  // Admin: get jobs for specific recruiter
  listJobsForRecruiter: (recruiterId: string) => 
    api.get(`/jobs/?recruiter_id=${recruiterId}`).then((r) => r.data),

  listAllJobs: () => api.get('/jobs/').then((r) => r.data),

  getJob: (id: string) => api.get(`/jobs/${id}`).then((r) => r.data),

  getJobStatus: (id: string) => api.get(`/jobs/${id}/status`).then((r) => r.data),

  addCandidates: (jobId: string, formData: FormData) =>
    api
      .post(`/jobs/${jobId}/add-candidates`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  cancelJob: (jobId: string) =>
    api.post(`/jobs/${jobId}/cancel`).then((r) => r.data),

  getClientAnalytics: () => api.get('/jobs/analytics/client-performance').then((r) => r.data),

  // Admin: get analytics for specific recruiter
  getClientAnalyticsForRecruiter: (recruiterId: string) => 
    api.get(`/jobs/analytics/client-performance?recruiter_id=${recruiterId}`).then((r) => r.data),

  adminDeleteJob: (id: string) => api.delete(`/jobs/${id}`),
}

// ─── Candidates ───────────────────────────────────────────────────────────────
export const candidateService = {
  listCandidates: (params?: {
    job_id?: string
    status?: string
    review_status?: string
    min_score?: number
    recruiter_id?: string
    page?: number
    page_size?: number
  }) => api.get('/candidates/', { params }).then((r) => r.data),

  listAllCandidates: (params?: {
    status?: string
    review_status?: string
    recruiter_id?: string
    page?: number
    page_size?: number
  }) => api.get('/candidates/', { params }).then((r) => r.data),

  getCandidate: (id: string) => api.get(`/candidates/${id}`).then((r) => r.data),

  shortlist: (candidateIds: string[]) =>
    api.post('/candidates/shortlist', { candidate_ids: candidateIds }).then((r) => r.data),

  updateReviewStatus: (candidateId: string, review_status: string) =>
    api.patch(`/candidates/${candidateId}/review-status`, { review_status }).then((r) => r.data),

  deleteCandidate: (id: string) => api.delete(`/candidates/${id}`),

  adminDeleteCandidate: (id: string) => api.delete(`/candidates/${id}`),
}
