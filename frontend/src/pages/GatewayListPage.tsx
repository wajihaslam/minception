import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import GatewayFormModal from '@/components/GatewayFormModal'
import { useGateways } from '@/hooks/useGateways'
import apiClient from '@/lib/axios'

function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3 animate-pulse">
      <div className="h-5 bg-gray-800 rounded w-2/5" />
      <div className="h-4 bg-gray-800 rounded w-1/4" />
      <div className="h-4 bg-gray-800 rounded w-3/4" />
      <div className="h-4 bg-gray-800 rounded w-1/3" />
    </div>
  )
}

export default function GatewayListPage() {
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [clearing, setClearing] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: gateways, isLoading, isError, error, refetch } = useGateways()

  async function clearAllGateways() {
    if (!confirm('Delete ALL gateways and their endpoints/flavors? This cannot be undone.')) return
    setClearing(true)
    try {
      await apiClient.delete('/admin/gateways/')
      queryClient.invalidateQueries({ queryKey: ['gateways'] })
    } finally {
      setClearing(false)
    }
  }

  const filtered = gateways?.filter((gw) => {
    const q = search.toLowerCase()
    return (
      gw.name.toLowerCase().includes(q) ||
      gw.base_path.toLowerCase().includes(q) ||
      (gw.description ?? '').toLowerCase().includes(q)
    )
  }) ?? []

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Gateways</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAllGateways}
              disabled={clearing || !gateways || gateways.length === 0}
              className="bg-red-600/20 hover:bg-red-600/30 disabled:opacity-40 text-red-400 border border-red-500/30 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {clearing ? 'Clearing…' : 'Clear All'}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Gateway
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, path or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 text-white text-sm rounded-lg pl-9 pr-4 py-2.5 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">
              {error instanceof Error ? error.message : 'Failed to load gateways'}
            </p>
            <button
              onClick={() => refetch()}
              className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && gateways?.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No gateways yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Create your first gateway
            </button>
          </div>
        )}

        {/* No search results */}
        {!isLoading && !isError && gateways && gateways.length > 0 && filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500">No gateways match <span className="text-white">"{search}"</span></p>
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((gw) => (
              <div
                key={gw.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`shrink-0 w-2 h-2 rounded-full ${gw.is_active ? 'bg-green-400' : 'bg-gray-600'}`}
                      title={gw.is_active ? 'Active' : 'Inactive'}
                    />
                    <h2 className="text-white font-semibold truncate">{gw.name}</h2>
                  </div>
                  <code className="shrink-0 text-xs bg-gray-800 text-indigo-300 px-2 py-0.5 rounded font-mono">
                    {gw.base_path}
                  </code>
                </div>

                {gw.description && (
                  <p className="text-sm text-gray-400 line-clamp-2">{gw.description}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-1">
                  <span className="text-xs text-gray-500">
                    {gw.endpoints.length} endpoint{gw.endpoints.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => navigate(`/gateways/${gw.id}`)}
                    className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    View →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && <GatewayFormModal onClose={() => setShowModal(false)} />}
    </Layout>
  )
}
