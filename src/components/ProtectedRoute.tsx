import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'

interface Props {
  children: ReactNode
  requiredRole?: string
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()

  if (!isLoaded) {
    return (
      <div className="loading-state" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span>Authenticating…</span>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole) {
    const role = (user?.publicMetadata as { role?: string })?.role
    if (role !== requiredRole) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}
