import { type FormEvent, useEffect, useState } from 'react'
import { useCreateEndpoint, useUpdateEndpoint } from '@/hooks/useEndpoints'
import type { Endpoint } from '@/types'

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const
type Method = typeof METHODS[number]

interface Props {
  gatewayId: string
  endpoint?: Endpoint
  onClose: () => void
}

export default function EndpointFormModal({ gatewayId, endpoint, onClose }: Props) {
  const [path, setPath] = useState(endpoint?.path ?? '')
  const [method, setMethod] = useState<Method>(endpoint?.method ?? 'GET')
  const [description, setDescription] = useState(endpoint?.description ?? '')

  const create = useCreateEndpoint(gatewayId)
  const update = useUpdateEndpoint(gatewayId)
  const mutation = endpoint ? update : create
  const isPending = mutation.isPending
  const errorMessage =
    mutation.error instanceof Error ? mutation.error.message : mutation.isError ? 'Something went wrong' : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isPending) return
    const input = { path, method, description }
    if (endpoint) {
      update.mutate({ eid: endpoint.id, input }, { onSuccess: onClose })
    } else {
      create.mutate(input, { onSuccess: onClose })
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 mt-20 h-fit shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            {endpoint ? 'Edit Endpoint' : 'New Endpoint'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-36 shrink-0">
              <label htmlFor="ep-method" className="block text-sm font-medium text-gray-300 mb-1.5">
                Method
              </label>
              <select
                id="ep-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow appearance-none cursor-pointer"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label htmlFor="ep-path" className="block text-sm font-medium text-gray-300 mb-1.5">
                Path
              </label>
              <input
                id="ep-path"
                type="text"
                required
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/users/:id"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ep-description" className="block text-sm font-medium text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              id="ep-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
            />
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
              {endpoint ? 'Save Changes' : 'Create Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
