import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import apiClient from '@/lib/axios'
import type { ApiResponse } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────

interface ErrorLog {
  id: string
  timestamp: string
  service: string
  level: string
  error_type: string | null
  message: string
  stack_trace: string | null
  logger_name: string | null
  module: string | null
  function: string | null
  line_no: number | null
  request_id: string | null
  user_id: string | null
  endpoint: string | null
  http_method: string | null
  http_status: number | null
  extra: Record<string, unknown> | null
}

interface Facet {
  value: string
  count: number
}

interface ErrorLogsResponse {
  logs: ErrorLog[]
  pagination: { page: number; page_size: number; total: number; total_pages: number }
  facets: { error_types: Facet[]; services: Facet[]; levels: Facet[] }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getDefaultStart() {
  const d = new Date()
  d.setDate(d.getDate() - 5)
  return d.toISOString().split('T')[0]
}

function getDefaultEnd() {
  return new Date().toISOString().split('T')[0]
}

const LEVEL_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  ERROR: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  WARNING: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  INFO: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
}

const SERVICE_STYLES: Record<string, string> = {
  'admin-service': 'bg-indigo-500/15 text-indigo-400',
  'mock-service': 'bg-purple-500/15 text-purple-400',
}

// ── Sub-components ─────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: string }) {
  const cls = LEVEL_STYLES[level] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {level}
    </span>
  )
}

function ServiceBadge({ service }: { service: string }) {
  const cls = SERVICE_STYLES[service] ?? 'bg-gray-500/15 text-gray-400'
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>
      {service}
    </span>
  )
}

// ── Detail Modal ───────────────────────────────────────────────────────────

function DetailModal({
  log,
  onClose,
  onFilterByRequestId,
}: {
  log: ErrorLog
  onClose: () => void
  onFilterByRequestId: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <LevelBadge level={log.level} />
            <span className="text-white font-semibold text-sm">
              {log.error_type ?? 'Log Detail'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyJson}
              className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy as JSON'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Message */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Message</p>
            <p className="text-sm text-gray-200 break-words">{log.message}</p>
          </div>

          {/* Request context */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Request Context</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Timestamp', new Date(log.timestamp).toLocaleString()],
                ['Service', log.service],
                ['Endpoint', log.endpoint ?? '—'],
                ['Method', log.http_method ?? '—'],
                ['Status', log.http_status != null ? String(log.http_status) : '—'],
                ['User', log.user_id ?? '—'],
                ['Module', log.module ?? '—'],
                ['Function', log.function ?? '—'],
                ['Line', log.line_no != null ? String(log.line_no) : '—'],
                ['Logger', log.logger_name ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-gray-200 font-mono text-xs truncate mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Request ID */}
          {log.request_id && (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800/50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Request ID</p>
                <p className="text-gray-200 font-mono text-xs mt-0.5">{log.request_id}</p>
              </div>
              <button
                onClick={() => {
                  onFilterByRequestId(log.request_id!)
                  onClose()
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                View related logs
              </button>
            </div>
          )}

          {/* Stack trace */}
          {log.stack_trace && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Stack Trace</p>
              <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 font-mono overflow-auto max-h-72 whitespace-pre-wrap break-words">
                {log.stack_trace}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ErrorLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Read filter state from URL
  const search = searchParams.get('search') ?? ''
  const levels = searchParams.getAll('level')
  const services = searchParams.getAll('service')
  const errorTypes = searchParams.getAll('error_type')
  const requestId = searchParams.get('request_id') ?? ''
  const startDate = searchParams.get('start') ?? getDefaultStart()
  const endDate = searchParams.get('end') ?? getDefaultEnd()
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(searchParams.get('page_size') ?? '25', 10)

  function updateParams(updates: Record<string, string | string[] | undefined>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, val] of Object.entries(updates)) {
        next.delete(key)
        if (Array.isArray(val)) {
          val.forEach((v) => next.append(key, v))
        } else if (val !== undefined && val !== '') {
          next.set(key, val)
        }
      }
      return next
    })
  }

  function resetFilters() {
    setSearchInput('')
    setSearchParams({ start: getDefaultStart(), end: getDefaultEnd() })
  }

  // Debounce search input → URL
  useEffect(() => {
    const timer = setTimeout(() => {
      updateParams({ search: searchInput || undefined, page: '1' })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  function toggleMulti(key: string, value: string, current: string[]) {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    updateParams({ [key]: next.length ? next : undefined, page: '1' })
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['error-logs', search, levels, services, errorTypes, requestId, startDate, endDate, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      levels.forEach((l) => params.append('levels', l))
      services.forEach((s) => params.append('services', s))
      errorTypes.forEach((et) => params.append('error_types', et))
      if (requestId) params.set('request_id', requestId)
      params.set('start_date', startDate)
      params.set('end_date', endDate)
      params.set('page', String(page))
      params.set('page_size', String(pageSize))

      const { data } = await apiClient.get<ApiResponse<ErrorLogsResponse>>(
        `/admin/error-logs/?${params.toString()}`,
      )
      if (!data.success || !data.data)
        throw new Error(data.error?.message ?? 'Failed to load error logs')
      return data.data
    },
    refetchInterval: autoRefresh ? 30_000 : false,
  })

  const facets = data?.facets
  const pagination = data?.pagination

  const activeFilterCount = [
    search,
    ...levels,
    ...services,
    ...errorTypes,
    requestId,
  ].filter(Boolean).length

  const ALL_LEVELS = ['ERROR', 'CRITICAL', 'WARNING']
  const ALL_SERVICES = ['admin-service', 'mock-service']
  const errorTypeOptions = facets?.error_types.map((f) => f.value) ?? []

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Error Logs</h1>
            {pagination && (
              <p className="text-sm text-gray-400 mt-0.5">
                {pagination.total.toLocaleString()} entries
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <div
                onClick={() => setAutoRefresh((v) => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-indigo-500' : 'bg-gray-700'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoRefresh ? 'translate-x-4' : ''}`}
                />
              </div>
              Auto-refresh (30s)
            </label>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5 space-y-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search messages…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => updateParams({ start: e.target.value, page: '1' })}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-gray-500 text-sm">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => updateParams({ end: e.target.value, page: '1' })}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Date presets */}
            <div className="flex items-center gap-1">
              {[
                { label: '24h', days: 1 },
                { label: '5d', days: 5 },
                { label: '7d', days: 7 },
                { label: '30d', days: 30 },
              ].map(({ label, days }) => {
                const s = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
                const e = getDefaultEnd()
                const active = startDate === s && endDate === e
                return (
                  <button
                    key={label}
                    onClick={() => updateParams({ start: s, end: e, page: '1' })}
                    className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${active ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Reset */}
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 rounded-lg transition-colors"
            >
              Reset
              {activeFilterCount > 0 && (
                <span className="bg-indigo-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Level toggles */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Level</span>
              <div className="flex gap-1">
                {ALL_LEVELS.map((lv) => {
                  const active = levels.includes(lv)
                  const cls = LEVEL_STYLES[lv] ?? ''
                  return (
                    <button
                      key={lv}
                      onClick={() => toggleMulti('level', lv, levels)}
                      className={`text-xs px-2.5 py-1 rounded border transition-all ${active ? cls : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'}`}
                    >
                      {lv}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Service toggles */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Service</span>
              <div className="flex gap-1">
                {ALL_SERVICES.map((svc) => {
                  const active = services.includes(svc)
                  const cls = SERVICE_STYLES[svc] ?? ''
                  return (
                    <button
                      key={svc}
                      onClick={() => toggleMulti('service', svc, services)}
                      className={`text-xs px-2.5 py-1 rounded transition-all ${active ? `${cls} ring-1 ring-current` : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
                    >
                      {svc}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Error type select */}
            {errorTypeOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Error Type</span>
                <select
                  multiple
                  value={errorTypes}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
                    updateParams({ error_type: selected.length ? selected : undefined, page: '1' })
                  }}
                  size={Math.min(errorTypeOptions.length, 4)}
                  className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
                >
                  {errorTypeOptions.map((et) => (
                    <option key={et} value={et}>{et}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Active request_id filter indicator */}
            {requestId && (
              <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-1">
                <span className="text-xs text-indigo-400">request_id: {requestId}</span>
                <button
                  onClick={() => updateParams({ request_id: undefined, page: '1' })}
                  className="text-indigo-400 hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-900 border border-gray-800 rounded-lg" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <p className="text-red-400">Failed to load error logs. Check your connection and try again.</p>
          </div>
        )}

        {/* Empty state */}
        {data && data.logs.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-gray-500">No error logs found for the selected filters.</p>
          </div>
        )}

        {/* Table */}
        {data && data.logs.length > 0 && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/40 border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <ServiceBadge service={log.service} />
                      </td>
                      <td className="px-4 py-3">
                        <LevelBadge level={log.level} />
                      </td>
                      <td className="px-4 py-3">
                        {log.error_type ? (
                          <span className="text-xs font-mono text-gray-300 bg-gray-800 px-2 py-0.5 rounded">
                            {log.error_type}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span
                          className="text-gray-300 text-xs truncate block"
                          title={log.message}
                        >
                          {log.message}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500 text-xs truncate max-w-[160px]">
                        {log.endpoint ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateParams({ page: String(page - 1) })}
                    disabled={page <= 1}
                    className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-400">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  <button
                    onClick={() => updateParams({ page: String(page + 1) })}
                    disabled={page >= pagination.total_pages}
                    className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                  >
                    Next
                  </button>
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => updateParams({ page_size: e.target.value, page: '1' })}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  {[25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedLog && (
        <DetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onFilterByRequestId={(id) =>
            updateParams({ request_id: id, page: '1' })
          }
        />
      )}
    </Layout>
  )
}
