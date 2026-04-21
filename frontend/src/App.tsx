import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'

// User Pages
import DashboardPage from './pages/DashboardPage'
import UploadPage from './pages/UploadPage'
import JobResultsPage from './pages/JobResultsPage'
import CandidateDetailPage from './pages/CandidateDetailPage'
import AnalysisPage from './pages/AnalysisPage'

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AddRecruiterPage from './pages/admin/AddRecruiterPage'
import Layout from './components/common/Layout'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Array<'user' | 'admin'>
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const token = useAuthStore((s) => s.accessToken)
  const userRole = useAuthStore((s) => s.userRole)
  
  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(userRole as 'user' | 'admin')) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  const token = useAuthStore((s) => s.accessToken)
  const userRole = useAuthStore((s) => s.userRole)

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* User Routes */}
        <Route
          path="/user"
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/user/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="jobs/:jobId" element={<JobResultsPage />} />
          <Route path="candidates/:candidateId" element={<CandidateDetailPage />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="add-recruiter" element={<AddRecruiterPage />} />
          <Route path="view-recruiter/:recruiterId" element={<DashboardPage isAdminView={true} />} />
          <Route path="view-recruiter/:recruiterId/analysis" element={<AnalysisPage />} />
          <Route path="candidates/:candidateId" element={<CandidateDetailPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
