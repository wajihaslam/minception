import { type FormEvent, useEffect, useState } from 'react'
import { useCreateGateway, useUpdateGateway } from '@/hooks/useGateways'
import type { Gateway } from '@/types'

interface GatewayFormModalProps {
  gateway?: Gateway
  onClose: () => void
}

export default function GatewayFormModal({ gateway, onClose }: GatewayFormModalProps) {
  const [name, setName] = useState(gateway?.name ?? '')
  const [basePath, setBasePath] = useState(gateway?.base_path ?? '')
  const [description, setDescription] = useState(gateway?.description ?? '')
  const [isActive, setIsActive] = useState(gateway?.is_active ?? true)

  const create = useCreateGateway()
  const update = useUpdateGateway()

  const mutation = gateway ? update : create
  const isPending = mutation.isPending

  const errorMessage =
    mutation.error instanceof Error ? mutation.error.message : mutation.isError ? 'Something went wrong' : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isPending) return

    const input = { name, base_path: basePath, description, is_active: isActive }

    if (gateway) {
      update.mutate({ id: gateway.id, input }, { onSuccess: onClose })
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
            {gateway ? 'Edit Gateway' : 'New Gateway'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="gw-name" className="block text-sm font-medium text-gray-300 mb-1.5">
              Name
            </label>
            <input
              id="gw-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Gateway"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            />
          </div>

          <div>
            <label htmlFor="gw-base-path" className="block text-sm font-medium text-gray-300 mb-1.5">
              Base Path
            </label>
            <input
              id="gw-base-path"
              type="text"
              required
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              placeholder="/api/v1"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            />
          </div>

          <div>
            <label htmlFor="gw-description" className="block text-sm font-medium text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              id="gw-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                isActive ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-gray-300">Active</span>
          </div>

          {errorMessage && (
            <p className="text-red-400 text-sm">{errorMessage}</p>
          )}

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
              {gateway ? 'Save Changes' : 'Create Gateway'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
