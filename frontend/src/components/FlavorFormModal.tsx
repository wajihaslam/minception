import { type FormEvent, useEffect, useState } from 'react'
import { useCreateFlavor, useUpdateFlavor } from '@/hooks/useFlavors'
import type { Flavor } from '@/types'

interface Props {
  gatewayId: string
  endpointId: string
  flavor?: Flavor
  onClose: () => void
}

function tryStringify(value: unknown): string {
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function parseJsonField(raw: string, label: string): { value: Record<string, unknown>; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: {}, error: null }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      return { value: {}, error: `${label} must be a JSON object` }
    }
    return { value: parsed as Record<string, unknown>, error: null }
  } catch {
    return { value: {}, error: `${label} is not valid JSON` }
  }
}

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  mono?: boolean
  hint?: string
}

function JsonTextarea({ id, label, value, onChange, placeholder, rows = 4, hint }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
        {hint && <span className="ml-1.5 text-xs text-gray-500 font-normal">{hint}</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-y"
      />
    </div>
  )
}

export default function FlavorFormModal({ gatewayId, endpointId, flavor, onClose }: Props) {
  const [name, setName] = useState(flavor?.name ?? '')
  const [statusCode, setStatusCode] = useState(String(flavor?.response.status ?? 200))
  const [delayMs, setDelayMs] = useState(String(flavor?.response.delay_ms ?? 0))
  const [priority, setPriority] = useState(String(flavor?.priority ?? 0))
  const [isDefault, setIsDefault] = useState(flavor?.is_default ?? false)
  const [bodyStr, setBodyStr] = useState(tryStringify(flavor?.response.body) || '{\n  \n}')
  const [headersStr, setHeadersStr] = useState(tryStringify(flavor?.response.headers) || '{\n  "Content-Type": "application/json"\n}')
  const [matchHeadersStr, setMatchHeadersStr] = useState(tryStringify(flavor?.match.headers))
  const [matchBodyStr, setMatchBodyStr] = useState(tryStringify(flavor?.match.body))
  const [matchQueryStr, setMatchQueryStr] = useState(tryStringify(flavor?.match.query))
  const [matchOpen, setMatchOpen] = useState(
    !!(flavor?.match.headers || flavor?.match.body || flavor?.match.query),
  )
  const [formError, setFormError] = useState<string | null>(null)

  const create = useCreateFlavor(gatewayId, endpointId)
  const update = useUpdateFlavor(gatewayId, endpointId)
  const mutation = flavor ? update : create
  const isPending = mutation.isPending
  const mutationError =
    mutation.error instanceof Error ? mutation.error.message : mutation.isError ? 'Something went wrong' : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isPending) return
    setFormError(null)

    const bodyResult = parseJsonField(bodyStr, 'Response body')
    const headersResult = parseJsonField(headersStr, 'Response headers')
    const matchHeadersResult = parseJsonField(matchHeadersStr, 'Match headers')
    const matchBodyResult = parseJsonField(matchBodyStr, 'Match body JSONPath')
    const matchQueryResult = parseJsonField(matchQueryStr, 'Match query')

    const firstError = [bodyResult, headersResult, matchHeadersResult, matchBodyResult, matchQueryResult]
      .map((r) => r.error)
      .find(Boolean)

    if (firstError) {
      setFormError(firstError)
      return
    }

    const input = {
      name,
      priority: Number(priority),
      is_default: isDefault,
      response: {
        status: Number(statusCode),
        headers: headersResult.value as Record<string, string>,
        body: bodyResult.value,
        delay_ms: Number(delayMs),
      },
      match: {
        headers: Object.keys(matchHeadersResult.value).length ? matchHeadersResult.value as Record<string, string> : undefined,
        body: Object.keys(matchBodyResult.value).length ? matchBodyResult.value as Record<string, string> : undefined,
        query: Object.keys(matchQueryResult.value).length ? matchQueryResult.value as Record<string, string> : undefined,
      },
    }

    if (flavor) {
      update.mutate({ fid: flavor.id, input }, { onSuccess: onClose })
    } else {
      create.mutate(input, { onSuccess: onClose })
    }
  }

  const errorMessage = formError ?? mutationError

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center overflow-y-auto py-10"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 h-fit shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            {flavor ? 'Edit Flavor' : 'New Flavor'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name + is_default */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label htmlFor="fl-name" className="block text-sm font-medium text-gray-300 mb-1.5">
                Name
              </label>
              <input
                id="fl-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="success-200"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900 cursor-pointer"
              />
              <span className="text-sm text-gray-300">Default flavor</span>
            </label>
          </div>

          {/* Status + Delay + Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="fl-status" className="block text-sm font-medium text-gray-300 mb-1.5">
                Status Code
              </label>
              <input
                id="fl-status"
                type="number"
                min={100}
                max={599}
                required
                value={statusCode}
                onChange={(e) => setStatusCode(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
            <div>
              <label htmlFor="fl-delay" className="block text-sm font-medium text-gray-300 mb-1.5">
                Delay (ms)
              </label>
              <input
                id="fl-delay"
                type="number"
                min={0}
                value={delayMs}
                onChange={(e) => setDelayMs(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
            <div>
              <label htmlFor="fl-priority" className="block text-sm font-medium text-gray-300 mb-1.5">
                Priority
              </label>
              <input
                id="fl-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
          </div>

          {/* Response headers */}
          <JsonTextarea
            id="fl-resp-headers"
            label="Response Headers"
            hint="JSON object"
            value={headersStr}
            onChange={setHeadersStr}
            placeholder={'{\n  "Content-Type": "application/json"\n}'}
            rows={3}
          />

          {/* Response body */}
          <JsonTextarea
            id="fl-resp-body"
            label="Response Body"
            hint="JSON object"
            value={bodyStr}
            onChange={setBodyStr}
            placeholder={'{\n  "message": "ok"\n}'}
            rows={6}
          />

          {/* Match rules — collapsible */}
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setMatchOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/40 hover:bg-gray-800/60 transition-colors text-left"
            >
              <span className="text-sm font-medium text-gray-300">Advanced — Match Rules</span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${matchOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {matchOpen && (
              <div className="p-4 space-y-4 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  Flavors are matched in descending priority order. Leave fields empty to skip that check.
                </p>
                <JsonTextarea
                  id="fl-match-headers"
                  label="Match Headers"
                  hint='{"Authorization": "Bearer admin_.*"}'
                  value={matchHeadersStr}
                  onChange={setMatchHeadersStr}
                  placeholder={'{\n  "Authorization": "Bearer admin_.*"\n}'}
                  rows={3}
                />
                <JsonTextarea
                  id="fl-match-body"
                  label="Match Body (JSONPath)"
                  hint='{"$.role": "admin"}'
                  value={matchBodyStr}
                  onChange={setMatchBodyStr}
                  placeholder={'{\n  "$.role": "admin"\n}'}
                  rows={3}
                />
                <JsonTextarea
                  id="fl-match-query"
                  label="Match Query Params"
                  hint='{"page": "1"}'
                  value={matchQueryStr}
                  onChange={setMatchQueryStr}
                  placeholder={'{\n  "page": "1"\n}'}
                  rows={3}
                />
              </div>
            )}
          </div>

          {errorMessage && <p className="text-red-400 text-sm">{errorMessage}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg py-2.5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              {isPending && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {flavor ? 'Save Changes' : 'Create Flavor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
