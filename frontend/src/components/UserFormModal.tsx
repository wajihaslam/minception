import { type FormEvent, useEffect, useState } from 'react'
import { useCreateUser, useUpdateUser } from '@/hooks/useUsers'
import type { User } from '@/types'

const ROLES = ['admin', 'editor', 'viewer'] as const
type Role = typeof ROLES[number]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  user?: User
  onClose: () => void
}

export default function UserFormModal({ user, onClose }: Props) {
  const isEdit = !!user

  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(user?.role ?? 'viewer')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [validationError, setValidationError] = useState<string | null>(null)

  const create = useCreateUser()
  const update = useUpdateUser()
  const mutation = isEdit ? update : create
  const isPending = mutation.isPending
  const mutationError =
    mutation.error instanceof Error ? mutation.error.message : mutation.isError ? 'Something went wrong' : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function validate(): string | null {
    if (!isEdit && !username.trim()) return 'Username is required'
    if (!email.trim() || !EMAIL_RE.test(email)) return 'A valid email address is required'
    if (!isEdit && password.length < 8) return 'Password must be at least 8 characters'
    return null
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isPending) return
    const err = validate()
    if (err) { setValidationError(err); return }
    setValidationError(null)

    if (isEdit && user) {
      update.mutate({ id: user.id, input: { email, role, is_active: isActive } }, { onSuccess: onClose })
    } else {
      create.mutate({ username, email, password, role, is_active: isActive }, { onSuccess: onClose })
    }
  }

  const errorMessage = validationError ?? mutationError

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow'

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md mx-4 mt-20 h-fit shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit User' : 'New User'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div>
              <label htmlFor="u-username" className="block text-sm font-medium text-gray-300 mb-1.5">
                Username
              </label>
              <input
                id="u-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label htmlFor="u-email" className="block text-sm font-medium text-gray-300 mb-1.5">
              Email
            </label>
            <input
              id="u-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className={inputCls}
            />
          </div>

          {!isEdit && (
            <div>
              <label htmlFor="u-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                id="u-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label htmlFor="u-role" className="block text-sm font-medium text-gray-300 mb-1.5">
              Role
            </label>
            <select
              id="u-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={`${inputCls} appearance-none cursor-pointer`}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
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
              {isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
