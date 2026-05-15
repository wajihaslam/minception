import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import apiClient from '@/lib/axios'
import type { ApiResponse } from '@/types'

interface RequestLog {
  id: string
  endpoint_path: string
  method: string
  matched_flavor: string | null
  matched: boolean
  request: { headers: Record<string, string>; query: Record<string, string> }
  response: { status: number }
  client_ip: string | null
  timestamp: string
}

interface LogsResponse {
  logs: RequestLog[]
  total: number
  limit: number
  skip: number
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-green-500/15 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
  PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

function statusColor(status: number) {
  if (status < 300) return 'text-green-400'
  if (status < 400) return 'text-amber-400'
  return 'text-red-400'
}

export default function LogsPage() {
  const [skip, setSkip] = useState(0)
  const [clearing, setClearing] = useState(false)
  const limit = 50
  const queryClient = useQueryClient()

  async function clearAllLogs() {
    if (!confirm('Delete all request logs? This cannot be undone.')) return
    setClearing(true)
    try {
      await apiClient.delete('/admin/logs/')
      setSkip(0)
      queryClient.invalidateQueries({ queryKey: ['logs'] })
    } finally {
      setClearing(false)
    }
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['logs', skip],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<LogsResponse>>(
        `/admin/logs/?limit=${limit}&skip=${skip}`,
      )
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to load logs')
      return data.data
    },
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0
  const currentPage = Math.floor(skip / limit) + 1

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Request Logs</h1>
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-sm text-gray-400">{data.total.toLocaleString()} total</span>
            )}
            <button
              onClick={clearAllLogs}
              disabled={clearing || !data || data.total === 0}
              className="bg-red-600/20 hover:bg-red-600/30 disabled:opacity-40 text-red-400 border border-red-500/30 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {clearing ? 'Clearing…' : 'Clear All'}
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-900 border border-gray-800 rounded-lg" />
            ))}
          </div>
        )}

        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <p className="text-red-400">Failed to load logs</p>
          </div>
        )}

        {data && data.logs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500">No request logs yet</p>
          </div>
        )}

        {data && data.logs.length > 0 && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/40 border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Path</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flavor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => {
                    const methodCls = METHOD_STYLES[log.method] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                    return (
                      <tr key={log.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${methodCls}`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-300 truncate max-w-xs">{log.endpoint_path}</td>
                        <td className={`px-4 py-3 font-mono font-semibold ${statusColor(log.response.status)}`}>
                          {log.response.status}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {log.matched_flavor ?? (
                            <span className="text-red-400/70 text-xs">unmatched</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.client_ip ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setSkip(Math.max(0, skip - limit))}
                  disabled={skip === 0}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setSkip(skip + limit)}
                  disabled={skip + limit >= data.total}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
