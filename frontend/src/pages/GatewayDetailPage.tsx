import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '@/components/Layout'
import GatewayFormModal from '@/components/GatewayFormModal'
import { useDeleteGateway, useGateway } from '@/hooks/useGateways'
import type { Endpoint, Flavor } from '@/types'

const METHOD_STYLES: Record<string, string> = {
  GET:    'bg-green-500/15 text-green-400 border-green-500/30',
  POST:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
  PATCH:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_STYLES[method] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'
  return (
    <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {method}
    </span>
  )
}

function FlavorRow({ flavor }: { flavor: Flavor }) {
  return (
    <tr className="border-t border-gray-800">
      <td className="px-4 py-2.5 text-sm text-white">{flavor.name}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-gray-300">{flavor.response.status}</td>
      <td className="px-4 py-2.5 text-sm text-gray-300">{flavor.priority}</td>
      <td className="px-4 py-2.5">
        {flavor.is_default && (
          <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
            default
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-400">{flavor.response.delay_ms}ms</td>
    </tr>
  )
}

function EndpointRow({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800/60 transition-colors text-left"
      >
        <MethodBadge method={endpoint.method} />
        <code className="text-sm text-white font-mono flex-1 truncate">{endpoint.path}</code>
        {endpoint.description && (
          <span className="text-xs text-gray-500 truncate max-w-xs hidden sm:block">
            {endpoint.description}
          </span>
        )}
        <span className="text-xs text-gray-500 shrink-0">
          {endpoint.flavors.length} flavor{endpoint.flavors.length !== 1 ? 's' : ''}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-800">
          {endpoint.flavors.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No flavors configured</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/40">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delay</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.flavors.map((flavor) => (
                  <FlavorRow key={flavor.id} flavor={flavor} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default function GatewayDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [showEditModal, setShowEditModal] = useState(false)
  const { data: gateway, isLoading, isError, error } = useGateway(id ?? '')
  const deleteGateway = useDeleteGateway()

  function handleDelete() {
    if (!gateway) return
    if (!window.confirm(`Delete "${gateway.name}"? This cannot be undone.`)) return
    deleteGateway.mutate(gateway.id)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Back */}
        <Link
          to="/gateways"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Gateways
        </Link>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/3" />
            <div className="h-5 bg-gray-800 rounded w-1/5" />
            <div className="h-4 bg-gray-800 rounded w-2/3 mt-6" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <p className="text-red-400">{error instanceof Error ? error.message : 'Failed to load gateway'}</p>
          </div>
        )}

        {/* Content */}
        {gateway && (
          <>
            {/* Gateway header */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white">{gateway.name}</h1>
                  <code className="text-sm bg-gray-800 text-indigo-300 px-2.5 py-0.5 rounded font-mono">
                    {gateway.base_path}
                  </code>
                  <span
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                      gateway.is_active
                        ? 'bg-green-500/10 text-green-400 border-green-500/30'
                        : 'bg-gray-500/10 text-gray-400 border-gray-600'
                    }`}
                  >
                    {gateway.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {gateway.description && (
                  <p className="text-gray-400">{gateway.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteGateway.isPending}
                  className="bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
                >
                  {deleteGateway.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            {/* Endpoints section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Endpoints
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({gateway.endpoints.length})
                  </span>
                </h2>
                <button
                  onClick={() => alert('Coming in next sprint')}
                  className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Endpoint
                </button>
              </div>

              {gateway.endpoints.length === 0 ? (
                <div className="text-center py-12 border border-gray-800 border-dashed rounded-xl">
                  <p className="text-gray-500">No endpoints yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {gateway.endpoints.map((endpoint) => (
                    <EndpointRow key={endpoint.id} endpoint={endpoint} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showEditModal && gateway && (
        <GatewayFormModal gateway={gateway} onClose={() => setShowEditModal(false)} />
      )}
    </Layout>
  )
}
