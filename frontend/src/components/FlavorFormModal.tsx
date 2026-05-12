import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useCreateFlavor, useUpdateFlavor } from '@/hooks/useFlavors'
import type {
  ConditionOperator,
  DatetimeFormat,
  Flavor,
  FlavorCondition,
  FlavorConditionResponse,
  FlavorParam,
  ParamSource,
} from '@/types'

interface Props {
  gatewayId: string
  endpointId: string
  flavor?: Flavor
  onClose: () => void
}

// ─── helpers ────────────────────────────────────────────────────────────────

function tryStringify(value: unknown): string {
  if (value === undefined || value === null) return ''
  try { return JSON.stringify(value, null, 2) } catch { return '' }
}

function parseJsonField(raw: string, label: string): { value: Record<string, unknown>; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: {}, error: null }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)
      return { value: {}, error: `${label} must be a JSON object` }
    return { value: parsed as Record<string, unknown>, error: null }
  } catch {
    return { value: {}, error: `${label} is not valid JSON` }
  }
}

const SOURCE_LABELS: Record<ParamSource, string> = {
  'request.header': 'Request Header',
  'request.body': 'Request Body',
  'request.query': 'Request Query',
  datetime: 'Datetime',
}

const DATETIME_FORMAT_LABELS: Record<DatetimeFormat, string> = {
  iso: 'ISO 8601  (2026-05-12T10:30:00.000Z)',
  unix: 'Unix timestamp  (1747045800)',
  date: 'Date only  (2026-05-12)',
  time: 'Time only  (10:30:00)',
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'equals',
  neq: 'not equals',
  contains: 'contains',
  matches: 'matches regex',
}

// ─── JsonTextarea with Validate / Fix / param chips ─────────────────────────

type ValidationState = 'idle' | 'valid' | 'invalid'

interface JsonTextareaProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  hint?: string
  params?: FlavorParam[]
}

function JsonTextarea({ id, label, value, onChange, placeholder, rows = 4, hint, params = [] }: JsonTextareaProps) {
  const [vs, setVs] = useState<ValidationState>('idle')
  const [vsMsg, setVsMsg] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleValidate() {
    const trimmed = value.trim()
    if (!trimmed) { setVs('valid'); setVsMsg('Empty — treated as {}'); return }
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setVs('invalid'); setVsMsg('Must be a JSON object, not an array or primitive'); return
      }
      setVs('valid'); setVsMsg('Valid JSON object')
    } catch (err) {
      setVs('invalid'); setVsMsg(err instanceof SyntaxError ? err.message : 'Invalid JSON')
    }
  }

  function handleFix() {
    const trimmed = value.trim()
    if (!trimmed) return
    try {
      onChange(JSON.stringify(JSON.parse(trimmed), null, 2))
      setVs('valid'); setVsMsg('Fixed and formatted')
    } catch (err) {
      setVs('invalid'); setVsMsg(err instanceof SyntaxError ? err.message : 'Cannot fix — invalid JSON')
    }
  }

  function insertParam(name: string) {
    const el = textareaRef.current
    if (!el) { onChange(value + `{{${name}}}`); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = value.slice(0, start) + `{{${name}}}` + value.slice(end)
    onChange(next)
    // restore cursor after React re-render
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + name.length + 4
      el.focus()
    })
  }

  const borderClass =
    vs === 'valid' ? 'border-green-500 focus:ring-green-500'
    : vs === 'invalid' ? 'border-red-500 focus:ring-red-500'
    : 'border-gray-700 focus:ring-indigo-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-gray-300">
          {label}
          {hint && <span className="ml-1.5 text-xs text-gray-500 font-normal">{hint}</span>}
        </label>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleValidate}
            className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors font-medium">
            Validate
          </button>
          <button type="button" onClick={handleFix}
            className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors font-medium">
            Fix JSON
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => { setVs('idle'); setVsMsg(''); onChange(e.target.value) }}
        placeholder={placeholder}
        spellCheck={false}
        className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 transition-shadow resize-y ${borderClass}`}
      />

      {vsMsg && (
        <p className={`mt-1 text-xs ${vs === 'valid' ? 'text-green-400' : 'text-red-400'}`}>
          {vs === 'valid' ? '✓' : '✗'} {vsMsg}
        </p>
      )}

      {params.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-600 self-center">Insert:</span>
          {params.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => insertParam(p.name)}
              title={`Source: ${SOURCE_LABELS[p.source]}${p.source !== 'datetime' ? ` › ${p.key}` : ''}`}
              className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 hover:bg-indigo-800 hover:text-indigo-100 transition-colors font-mono"
            >
              {`{{${p.name}}}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Parameter row ───────────────────────────────────────────────────────────

interface ParamRowProps {
  param: FlavorParam
  onChange: (p: FlavorParam) => void
  onRemove: () => void
}

function ParamRow({ param, onChange, onRemove }: ParamRowProps) {
  const sources: ParamSource[] = ['request.header', 'request.body', 'request.query', 'datetime']
  const datetimeFormats: DatetimeFormat[] = ['iso', 'unix', 'date', 'time']
  const isDatetime = param.source === 'datetime'

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
      <input
        type="text"
        value={param.name}
        onChange={(e) => onChange({ ...param, name: e.target.value.replace(/\s/g, '_') })}
        placeholder="param_name"
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <select
        value={param.source}
        onChange={(e) => onChange({ ...param, source: e.target.value as ParamSource, key: e.target.value === 'datetime' ? 'iso' : '' })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {sources.map((s) => (
          <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
        ))}
      </select>

      {isDatetime ? (
        <select
          value={param.key}
          onChange={(e) => onChange({ ...param, key: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {datetimeFormats.map((f) => (
            <option key={f} value={f}>{DATETIME_FORMAT_LABELS[f]}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={param.key}
          onChange={(e) => onChange({ ...param, key: e.target.value })}
          placeholder={
            param.source === 'request.header' ? 'Authorization'
            : param.source === 'request.body' ? '$.userId'
            : 'page'
          }
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}

      <button type="button" onClick={onRemove}
        className="p-2 text-gray-600 hover:text-red-400 transition-colors rounded">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Condition row ───────────────────────────────────────────────────────────

interface ConditionRowProps {
  condition: FlavorCondition
  paramNames: string[]
  onChange: (c: FlavorCondition) => void
  onRemove: () => void
}

function ConditionRow({ condition, paramNames, onChange, onRemove }: ConditionRowProps) {
  const operators: ConditionOperator[] = ['eq', 'neq', 'contains', 'matches']
  const [respOpen, setRespOpen] = useState(false)
  const [respBodyStr, setRespBodyStr] = useState(tryStringify(condition.response.body) || '')
  const [respHeadersStr, setRespHeadersStr] = useState(tryStringify(condition.response.headers) || '')
  const [respStatus, setRespStatus] = useState(String(condition.response.status ?? ''))

  function commitResponse() {
    const bodyResult = parseJsonField(respBodyStr, 'Condition body')
    const headersResult = parseJsonField(respHeadersStr, 'Condition headers')
    const resp: FlavorConditionResponse = {}
    if (respStatus) resp.status = Number(respStatus)
    if (Object.keys(headersResult.value).length) resp.headers = headersResult.value as Record<string, string>
    if (Object.keys(bodyResult.value).length) resp.body = bodyResult.value
    onChange({ ...condition, response: resp })
  }

  return (
    <div className="border border-gray-700/60 rounded-lg overflow-hidden">
      {/* if-row */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center p-3 bg-gray-800/30">
        <select
          value={condition.param}
          onChange={(e) => onChange({ ...condition, param: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">— pick param —</option>
          {paramNames.map((n) => (
            <option key={n} value={n}>{`{{${n}}}`}</option>
          ))}
        </select>
        <select
          value={condition.operator}
          onChange={(e) => onChange({ ...condition, operator: e.target.value as ConditionOperator })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {operators.map((op) => (
            <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
          ))}
        </select>
        <input
          type="text"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="expected value"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="button" onClick={onRemove}
          className="p-2 text-gray-600 hover:text-red-400 transition-colors rounded">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* then-row */}
      <div className="border-t border-gray-700/40">
        <button type="button" onClick={() => setRespOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors text-left">
          <span>
            then override response
            {condition.response.status && <span className="ml-2 text-indigo-400 font-mono">status={condition.response.status}</span>}
            {condition.response.body && <span className="ml-2 text-indigo-400">body set</span>}
            {condition.response.headers && <span className="ml-2 text-indigo-400">headers set</span>}
          </span>
          <svg className={`w-3.5 h-3.5 transition-transform ${respOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {respOpen && (
          <div className="p-3 pt-0 space-y-2 border-t border-gray-700/40">
            <p className="text-xs text-gray-600">Leave empty to keep the default flavor response for that field.</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status Code</label>
                <input type="number" min={100} max={599} value={respStatus}
                  onChange={(e) => setRespStatus(e.target.value)}
                  onBlur={commitResponse}
                  placeholder="200"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Headers override</label>
              <textarea rows={2} value={respHeadersStr} spellCheck={false}
                onChange={(e) => setRespHeadersStr(e.target.value)}
                onBlur={commitResponse}
                placeholder={'{\n  "X-Custom": "value"\n}'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Body override</label>
              <textarea rows={3} value={respBodyStr} spellCheck={false}
                onChange={(e) => setRespBodyStr(e.target.value)}
                onBlur={commitResponse}
                placeholder={'{\n  "role": "admin"\n}'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main modal ──────────────────────────────────────────────────────────────

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
  const [matchOpen, setMatchOpen] = useState(!!(flavor?.match.headers || flavor?.match.body || flavor?.match.query))

  // params
  const [params, setParams] = useState<FlavorParam[]>(flavor?.params ?? [])
  const [paramsOpen, setParamsOpen] = useState((flavor?.params ?? []).length > 0)

  // conditions
  const [conditions, setConditions] = useState<FlavorCondition[]>(flavor?.conditions ?? [])
  const [conditionsOpen, setConditionsOpen] = useState((flavor?.conditions ?? []).length > 0)

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

  function addParam() {
    setParams((prev) => [...prev, { name: `param${prev.length + 1}`, source: 'request.header', key: '' }])
    setParamsOpen(true)
  }

  function addCondition() {
    const first = params[0]?.name ?? ''
    setConditions((prev) => [...prev, { param: first, operator: 'eq', value: '', response: {} }])
    setConditionsOpen(true)
  }

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
      .map((r) => r.error).find(Boolean)
    if (firstError) { setFormError(firstError); return }

    // validate params
    for (const p of params) {
      if (!p.name.trim()) { setFormError('All parameters need a name'); return }
      if (p.source !== 'datetime' && !p.key.trim()) { setFormError(`Parameter "${p.name}" needs a key`); return }
    }

    // validate conditions
    for (const c of conditions) {
      if (!c.param) { setFormError('All conditions must reference a parameter'); return }
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
      params: params.length ? params : undefined,
      conditions: conditions.length ? conditions : undefined,
    }

    if (flavor) {
      update.mutate({ fid: flavor.id, input }, { onSuccess: onClose })
    } else {
      create.mutate(input, { onSuccess: onClose })
    }
  }

  const paramNames = params.map((p) => p.name).filter(Boolean)
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
              <label htmlFor="fl-name" className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
              <input id="fl-name" type="text" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="success-200"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
            </div>
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer select-none shrink-0">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900 cursor-pointer" />
              <span className="text-sm text-gray-300">Default flavor</span>
            </label>
          </div>

          {/* Status + Delay + Priority */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'fl-status', label: 'Status Code', value: statusCode, set: setStatusCode, min: 100, max: 599 },
              { id: 'fl-delay',  label: 'Delay (ms)',  value: delayMs,    set: setDelayMs,    min: 0    },
              { id: 'fl-prio',   label: 'Priority',    value: priority,   set: setPriority              },
            ].map(({ id, label, value, set, min, max }) => (
              <div key={id}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
                <input id={id} type="number" min={min} max={max} required={id === 'fl-status'} value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
              </div>
            ))}
          </div>

          {/* Response headers */}
          <JsonTextarea id="fl-resp-headers" label="Response Headers" hint="JSON object"
            value={headersStr} onChange={setHeadersStr} rows={3}
            placeholder={'{\n  "Content-Type": "application/json"\n}'}
            params={params} />

          {/* Response body */}
          <JsonTextarea id="fl-resp-body" label="Response Body" hint="JSON object"
            value={bodyStr} onChange={setBodyStr} rows={6}
            placeholder={'{\n  "message": "ok"\n}'}
            params={params} />

          {/* ── Parameters ── */}
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <button type="button" onClick={() => setParamsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/40 hover:bg-gray-800/60 transition-colors text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-300">Parameters</span>
                {params.length > 0 && (
                  <span className="text-xs bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded-full border border-indigo-700/40">
                    {params.length}
                  </span>
                )}
              </div>
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${paramsOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {paramsOpen && (
              <div className="p-4 space-y-3 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  Extract values from the incoming request and reference them as <code className="text-indigo-400 font-mono">{`{{name}}`}</code> in Response Headers/Body.
                  Datetime params inject the current time.
                </p>

                {params.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1">
                      {['Name', 'Source', 'Key / Format', ''].map((h) => (
                        <span key={h} className="text-xs font-medium text-gray-600 uppercase tracking-wide">{h}</span>
                      ))}
                    </div>
                    {params.map((p, i) => (
                      <ParamRow key={i} param={p}
                        onChange={(updated) => setParams((prev) => prev.map((x, idx) => idx === i ? updated : x))}
                        onRemove={() => setParams((prev) => prev.filter((_, idx) => idx !== i))} />
                    ))}
                  </div>
                )}

                <button type="button" onClick={addParam}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Parameter
                </button>
              </div>
            )}
          </div>

          {/* ── Conditions ── */}
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <button type="button" onClick={() => setConditionsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/40 hover:bg-gray-800/60 transition-colors text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-300">Conditions</span>
                {conditions.length > 0 && (
                  <span className="text-xs bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-700/40">
                    {conditions.length}
                  </span>
                )}
              </div>
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${conditionsOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {conditionsOpen && (
              <div className="p-4 space-y-3 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  Override status / headers / body when a parameter matches a condition. Evaluated after flavor is selected.
                  Define Parameters first so they appear in the dropdown.
                </p>

                {conditions.length === 0 && (
                  <p className="text-xs text-gray-600 italic">No conditions yet.</p>
                )}

                {conditions.map((c, i) => (
                  <ConditionRow key={i} condition={c} paramNames={paramNames}
                    onChange={(updated) => setConditions((prev) => prev.map((x, idx) => idx === i ? updated : x))}
                    onRemove={() => setConditions((prev) => prev.filter((_, idx) => idx !== i))} />
                ))}

                <button type="button" onClick={addCondition}
                  disabled={params.length === 0}
                  title={params.length === 0 ? 'Add a parameter first' : undefined}
                  className="text-sm text-amber-400 hover:text-amber-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Condition
                </button>
              </div>
            )}
          </div>

          {/* ── Match rules ── */}
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <button type="button" onClick={() => setMatchOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/40 hover:bg-gray-800/60 transition-colors text-left">
              <span className="text-sm font-medium text-gray-300">Advanced — Match Rules</span>
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${matchOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {matchOpen && (
              <div className="p-4 space-y-4 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  Flavors are matched in descending priority order. Leave fields empty to skip that check.
                </p>
                <JsonTextarea id="fl-match-headers" label="Match Headers"
                  hint='{"Authorization": "Bearer admin_.*"}'
                  value={matchHeadersStr} onChange={setMatchHeadersStr} rows={3}
                  placeholder={'{\n  "Authorization": "Bearer admin_.*"\n}'} />
                <JsonTextarea id="fl-match-body" label="Match Body (JSONPath)"
                  hint='{"$.role": "admin"}'
                  value={matchBodyStr} onChange={setMatchBodyStr} rows={3}
                  placeholder={'{\n  "$.role": "admin"\n}'} />
                <JsonTextarea id="fl-match-query" label="Match Query Params"
                  hint='{"page": "1"}'
                  value={matchQueryStr} onChange={setMatchQueryStr} rows={3}
                  placeholder={'{\n  "page": "1"\n}'} />
              </div>
            )}
          </div>

          {errorMessage && <p className="text-red-400 text-sm">{errorMessage}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg py-2.5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2">
              {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {flavor ? 'Save Changes' : 'Create Flavor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
