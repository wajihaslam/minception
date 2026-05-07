import { Navigate, Route, Routes } from 'react-router-dom'
import { isAuthenticated } from '@/store/auth'
import LoginPage from '@/pages/LoginPage'
import GatewayListPage from '@/pages/GatewayListPage'
import GatewayDetailPage from '@/pages/GatewayDetailPage'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/gateways" replace />} />
      <Route path="/login" element={<LoginPage />} />
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
    </Routes>
  )
}
