import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn, useAuth, useUser } from '@clerk/clerk-react'
import AdminLayout from './pages/admin/AdminLayout'
import UserDashboard from './pages/UserDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function LoginPage() {
  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        <div className="auth-logo">
          <img src="/dishalogo.png" alt="Disha Logo" />
        </div>
        <SignIn routing="hash" />
      </div>
    </div>
  )
}

function RootRedirect() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()

  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/login" replace />

  const role = (user?.publicMetadata as { role?: string })?.role
  if (role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Admin routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      />

      {/* User routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
