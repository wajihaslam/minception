import { Navigate, Route, Routes } from 'react-router-dom'
import { isAuthenticated, getTokenPayload } from '@/store/auth'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import GatewayListPage from '@/pages/GatewayListPage'
import GatewayDetailPage from '@/pages/GatewayDetailPage'
import LogsPage from '@/pages/LogsPage'
import UsersPage from '@/pages/UsersPage'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  const payload = getTokenPayload()
  if (payload?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gateways"
        element={
          <ProtectedRoute>
            <GatewayListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gateways/:id"
        element={
          <ProtectedRoute>
            <GatewayDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <ProtectedRoute>
            <LogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        }
      />
    </Routes>
  )
}
