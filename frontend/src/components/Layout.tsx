import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { getTokenPayload } from '@/store/auth'
import { useLogout } from '@/hooks/useAuth'

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-indigo-500/20 text-indigo-300',
  editor: 'bg-amber-500/20 text-amber-300',
  viewer: 'bg-gray-500/20 text-gray-300',
}

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const logout = useLogout()
  const payload = getTokenPayload()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">
        {/* Wordmark */}
        <div className="px-5 py-5 border-b border-gray-800">
          <span className="text-xl font-bold text-indigo-500 tracking-tight">Minception</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink
            to="/gateways"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-800 text-indigo-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`
            }
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Gateways
          </NavLink>
        </nav>

        {/* User area */}
        <div className="px-3 pb-4 border-t border-gray-800 pt-4 space-y-3">
          {payload && (
            <div className="px-2">
              <p className="text-sm font-medium text-white truncate">{payload.sub}</p>
              <span
                className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[payload.role] ?? ROLE_COLORS['viewer']}`}
              >
                {payload.role}
              </span>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 bg-gray-950 text-white overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
