import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import type { RoleName } from '../types/auth'

interface ProtectedRouteProps extends PropsWithChildren {
  allowedRoles?: RoleName[]
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.roleName)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
