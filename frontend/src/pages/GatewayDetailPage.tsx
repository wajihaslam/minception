import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '@/components/Layout'
import GatewayFormModal from '@/components/GatewayFormModal'
import EndpointFormModal from '@/components/EndpointFormModal'
import FlavorFormModal from '@/components/FlavorFormModal'
import { useDeleteGateway, useGateway, useUpdateGatewayRaw } from '@/hooks/useGateways'
import { useCopyEndpoint, useDeleteEndpoint } from '@/hooks/useEndpoints'
import { useCopyFlavor, useDeleteFlavor } from '@/hooks/useFlavors'
import type { Endpoint, Flavor, Gateway } from '@/types'

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

// ── Endpoints tab ──────────────────────────────────────────────────────────

function FlavorRow({ flavor, onEdit, onCopy, onDelete }: { flavor: Flavor; onEdit: () => void; onCopy: () => void; onDelete: () => void  }) {
  return (
    <tr className="border-t border-gray-800 group">
      <td className="px-4 py-2.5 text-sm text-white">{flavor.name}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-gray-300">{flavor.response.status}</td>
      <td className="px-4 py-2.5 text-sm text-gray-300">{flavor.priority}</td>
      <td className="px-4 py-2.5">
        {flavor.is_default && (
          <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">default</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-400">{flavor.response.delay_ms}ms</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded transition-colors">Edit</button>
          <button onClick={onCopy} className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded transition-colors">Copy</button>
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded transition-colors">Delete</button>
        </div>
      </td>
    </tr>
  )
}

function EndpointRow({ endpoint, gatewayId, onEditEndpoint, onEditCopiedEndpoint, onAddFlavor, onEditFlavor, onEditCopiedFlavor }: {
  endpoint: Endpoint; gatewayId: string
  onEditEndpoint: () => void
  onEditCopiedEndpoint: (ep: Endpoint) => void
  onAddFlavor: () => void
  onEditFlavor: (f: Flavor) => void
  onEditCopiedFlavor: (f: Flavor) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const deleteEndpoint = useDeleteEndpoint(gatewayId)
  const copyEndpoint = useCopyEndpoint(gatewayId)
  const deleteFlavor = useDeleteFlavor(gatewayId, endpoint.id)
  const copyFlavor = useCopyFlavor(gatewayId, endpoint.id)

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800/40 transition-colors">
        <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm text-white font-mono flex-1 truncate">{endpoint.path}</code>
          {endpoint.description && <span className="text-xs text-gray-500 truncate max-w-xs hidden sm:block">{endpoint.description}</span>}
          <span className="text-xs text-gray-500 shrink-0">{endpoint.flavors.length} flavor{endpoint.flavors.length !== 1 ? 's' : ''}</span>
          <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEditEndpoint} className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded transition-colors">Edit</button>
          <button
            onClick={() => copyEndpoint.mutate(endpoint.id, { onSuccess: onEditCopiedEndpoint })}
            disabled={copyEndpoint.isPending}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
          >
            {copyEndpoint.isPending ? '…' : 'Copy'}
          </button>
          <button onClick={() => { if (window.confirm(`Delete ${endpoint.method} ${endpoint.path}?`)) deleteEndpoint.mutate(endpoint.id) }} disabled={deleteEndpoint.isPending} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded transition-colors disabled:opacity-50">
            {deleteEndpoint.isPending ? '…' : 'Delete'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800">
          {endpoint.flavors.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No flavors configured</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/40">
                  {['Name', 'Status', 'Priority', 'Default', 'Delay', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {endpoint.flavors.map(flavor => (
                  <FlavorRow
                    key={flavor.id}
                    flavor={flavor}
                    onEdit={() => onEditFlavor(flavor)}
                    onCopy={() => copyFlavor.mutate(flavor.id, { onSuccess: onEditCopiedFlavor })}
                    onDelete={() => { if (window.confirm(`Delete flavor "${flavor.name}"?`)) deleteFlavor.mutate(flavor.id) }}
                  />
                ))}
              </tbody>
            </table>
          )}
          <div className="px-4 py-3 border-t border-gray-800">
            <button onClick={onAddFlavor} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Flavor
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── JSON Editor tab ────────────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function gatewayToEditableJson(gw: Gateway): object {
  // Omit top-level id, created_at, updated_at — those are system-managed
  const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = gw as any
  return rest
}

type ValidationState = { status: 'idle' } | { status: 'ok' } | { status: 'error'; message: string }

function JsonEditorTab({ gateway }: { gateway: Gateway }) {
  const canonical = JSON.stringify(gatewayToEditableJson(gateway), null, 2)

  const [editMode, setEditMode] = useState(false)
  const [jsonText, setJsonText] = useState(canonical)
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [search, setSearch] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [matchIndex, setMatchIndex] = useState(0)
  const preRef = useRef<HTMLPreElement>(null)
  const matchRefs = useRef<HTMLElement[]>([])

  const updateRaw = useUpdateGatewayRaw()

  // Reset editor text when gateway data refreshes (and not in edit mode)
  useEffect(() => {
    if (!editMode) {
      setJsonText(JSON.stringify(gatewayToEditableJson(gateway), null, 2))
      setValidation({ status: 'idle' })
    }
  }, [gateway, editMode])

  // Count matches when search changes
  useEffect(() => {
    if (!search) { setMatchCount(0); setMatchIndex(0); return }
    const re = new RegExp(escapeRegex(search), 'gi')
    const matches = [...jsonText.matchAll(re)]
    setMatchCount(matches.length)
    setMatchIndex(matches.length > 0 ? 1 : 0)
  }, [search, jsonText])

  // Scroll to current match
  useEffect(() => {
    if (matchRefs.current[matchIndex - 1]) {
      matchRefs.current[matchIndex - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [matchIndex])

  function validateJson() {
    try {
      JSON.parse(jsonText)
      setValidation({ status: 'ok' })
    } catch (e: any) {
      setValidation({ status: 'error', message: e.message })
    }
  }

  async function handleSave() {
    try {
      JSON.parse(jsonText)
    } catch (e: any) {
      setValidation({ status: 'error', message: e.message })
      return
    }
    setSaveStatus('saving')
    setSaveError('')
    try {
      await updateRaw.mutateAsync({ id: gateway.id, doc: JSON.parse(jsonText) })
      setSaveStatus('saved')
      setEditMode(false)
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (e: any) {
      setSaveStatus('error')
      setSaveError(e.message)
    }
  }

  function handleDiscard() {
    setJsonText(JSON.stringify(gatewayToEditableJson(gateway), null, 2))
    setEditMode(false)
    setValidation({ status: 'idle' })
    setSaveStatus('idle')
    setSaveError('')
  }

  // Render JSON with search highlights (read-only mode only)
  function renderHighlighted() {
    if (!search) return <>{jsonText}</>
    const re = new RegExp(`(${escapeRegex(search)})`, 'gi')
    const parts = jsonText.split(re)
    let idx = 0
    matchRefs.current = []
    return (
      <>
        {parts.map((part, i) => {
          if (re.test(part)) {
            const thisIdx = idx++
            const isCurrent = thisIdx === matchIndex - 1
            return (
              <mark
                key={i}
                ref={el => { if (el) matchRefs.current[thisIdx] = el }}
                className={`rounded ${isCurrent ? 'bg-yellow-400/60 text-gray-900' : 'bg-yellow-400/20 text-yellow-200'}`}
              >
                {part}
              </mark>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search (read-only only) */}
        {!editMode && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Find in JSON…"
                value={search}
                onChange={e => { setSearch(e.target.value); setMatchIndex(1) }}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-8 pr-3 py-1.5 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-52"
              />
            </div>
            {search && matchCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">{matchIndex}/{matchCount}</span>
                <button onClick={() => setMatchIndex(i => i > 1 ? i - 1 : matchCount)} className="text-gray-400 hover:text-white p-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button onClick={() => setMatchIndex(i => i < matchCount ? i + 1 : 1)} className="text-gray-400 hover:text-white p-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            )}
            {search && matchCount === 0 && (
              <span className="text-xs text-red-400">No matches</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Edit JSON toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => { setEditMode(v => !v); setValidation({ status: 'idle' }); setSearch('') }}
              className={`relative w-9 h-5 rounded-full transition-colors ${editMode ? 'bg-indigo-500' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${editMode ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-gray-300">Edit JSON</span>
          </label>

          {/* Validate */}
          <button
            onClick={validateJson}
            className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Validate
          </button>

          {/* Save / Discard (edit mode only) */}
          {editMode && (
            <>
              <button
                onClick={handleDiscard}
                className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-1.5 rounded-lg transition-colors font-medium"
              >
                {saveStatus === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Validation result */}
      {validation.status === 'ok' && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          Valid JSON
        </div>
      )}
      {validation.status === 'error' && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="font-medium">Invalid JSON:</span> {validation.message}
        </div>
      )}
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          Saved successfully
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="font-medium">Save failed:</span> {saveError}
        </div>
      )}

      {/* JSON display / editor */}
      {editMode ? (
        <textarea
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setValidation({ status: 'idle' }) }}
          spellCheck={false}
          className="w-full h-[600px] bg-gray-950 border border-gray-700 focus:border-indigo-500 text-gray-200 font-mono text-sm rounded-xl p-4 resize-y focus:outline-none leading-relaxed"
        />
      ) : (
        <pre
          ref={preRef}
          className="w-full h-[600px] overflow-auto bg-gray-950 border border-gray-800 text-gray-200 font-mono text-sm rounded-xl p-4 leading-relaxed"
        >
          {renderHighlighted()}
        </pre>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

type Tab = 'endpoints' | 'json'

type ModalState =
  | { type: 'none' }
  | { type: 'editGateway' }
  | { type: 'addEndpoint' }
  | { type: 'editEndpoint'; endpoint: Endpoint }
  | { type: 'addFlavor'; endpoint: Endpoint }
  | { type: 'editFlavor'; endpoint: Endpoint; flavor: Flavor }

export default function GatewayDetailPage() {
  const { id } = useParams<{ id: string }>()
  const gatewayId = id ?? ''

  const [tab, setTab] = useState<Tab>('endpoints')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const { data: gateway, isLoading, isError, error } = useGateway(gatewayId)
  const deleteGateway = useDeleteGateway()

  function handleDeleteGateway() {
    if (!gateway) return
    if (!window.confirm(`Delete "${gateway.name}"? This cannot be undone.`)) return
    deleteGateway.mutate(gateway.id)
  }

  const closeModal = () => setModal({ type: 'none' })

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <Link to="/gateways" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Gateways
        </Link>

        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/3" />
            <div className="h-5 bg-gray-800 rounded w-1/5" />
            <div className="h-4 bg-gray-800 rounded w-2/3 mt-6" />
          </div>
        )}

        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <p className="text-red-400">{error instanceof Error ? error.message : 'Failed to load gateway'}</p>
          </div>
        )}

        {gateway && (
          <>
            {/* Gateway header */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white">{gateway.name}</h1>
                  <code className="text-sm bg-gray-800 text-indigo-300 px-2.5 py-0.5 rounded font-mono">{gateway.base_path}</code>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${gateway.is_active ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-600'}`}>
                    {gateway.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {gateway.description && <p className="text-gray-400">{gateway.description}</p>}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setModal({ type: 'editGateway' })} className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">Edit</button>
                <button onClick={handleDeleteGateway} disabled={deleteGateway.isPending} className="bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-60">
                  {deleteGateway.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
              {(['endpoints', 'json'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors capitalize ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {t === 'json' ? 'JSON Editor' : 'Endpoints'}
                  {t === 'endpoints' && (
                    <span className="ml-1.5 text-xs text-gray-500">({gateway.endpoints.length})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Endpoints tab */}
            {tab === 'endpoints' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Endpoints</h2>
                  <button onClick={() => setModal({ type: 'addEndpoint' })} className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Add Endpoint
                  </button>
                </div>

                {gateway.endpoints.length === 0 ? (
                  <div className="text-center py-12 border border-gray-800 border-dashed rounded-xl">
                    <p className="text-gray-500">No endpoints yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {gateway.endpoints.map(endpoint => (
                      <EndpointRow
                        key={endpoint.id}
                        endpoint={endpoint}
                        gatewayId={gatewayId}
                        onEditEndpoint={() => setModal({ type: 'editEndpoint', endpoint })}
                        onEditCopiedEndpoint={newEp => setModal({ type: 'editEndpoint', endpoint: newEp })}
                        onAddFlavor={() => setModal({ type: 'addFlavor', endpoint })}
                        onEditFlavor={flavor => setModal({ type: 'editFlavor', endpoint, flavor })}
                        onEditCopiedFlavor={newFlavor => setModal({ type: 'editFlavor', endpoint, flavor: newFlavor })}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* JSON Editor tab */}
            {tab === 'json' && <JsonEditorTab gateway={gateway} />}
          </>
        )}
      </div>

      {modal.type === 'editGateway' && gateway && <GatewayFormModal gateway={gateway} onClose={closeModal} />}
      {modal.type === 'addEndpoint' && <EndpointFormModal gatewayId={gatewayId} onClose={closeModal} />}
      {modal.type === 'editEndpoint' && <EndpointFormModal gatewayId={gatewayId} endpoint={modal.endpoint} onClose={closeModal} />}
      {modal.type === 'addFlavor' && <FlavorFormModal gatewayId={gatewayId} endpointId={modal.endpoint.id} onClose={closeModal} />}
      {modal.type === 'editFlavor' && <FlavorFormModal gatewayId={gatewayId} endpointId={modal.endpoint.id} flavor={modal.flavor} onClose={closeModal} />}
    </Layout>
  )
}
