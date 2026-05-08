import { useState } from 'react'
import Layout from '@/components/Layout'
import UserFormModal from '@/components/UserFormModal'
import { useUsers, useDeleteUser } from '@/hooks/useUsers'
import { getTokenPayload } from '@/store/auth'
import type { User } from '@/types'

const ROLE_COLORS: Record<string, string> = {
  admin:  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  editor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  viewer: 'bg-gray-500/15 text-gray-300 border-gray-600',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-t border-gray-800 animate-pulse">
          <td className="px-4 py-3"><div className="h-4 bg-gray-800 rounded w-24" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-gray-800 rounded w-40" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-800 rounded-full w-16" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-800 rounded-full w-14" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-gray-800 rounded w-20" /></td>
          <td className="px-4 py-3" />
        </tr>
      ))}
    </>
  )
}

export default function UsersPage() {
  const [editUser, setEditUser] = useState<User | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: users, isLoading, isError } = useUsers()
  const deleteUser = useDeleteUser()
  const currentPayload = getTokenPayload()
  const isAdmin = currentPayload?.role === 'admin'

  function handleDelete(user: User) {
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return
    deleteUser.mutate(user.id)
  }

  const isSelf = (user: User) => user.username === currentPayload?.sub

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Users</h1>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </button>
          )}
        </div>

        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-6">
            <p className="text-red-400">Failed to load users</p>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/40 border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonRows />}

              {!isLoading && users?.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}

              {users?.map((user) => (
                <tr key={user.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">
                    {user.username}
                    {isSelf(user) && (
                      <span className="ml-2 text-xs text-gray-500">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[user.role] ?? ROLE_COLORS['viewer']}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      user.is_active
                        ? 'bg-green-500/10 text-green-400 border-green-500/30'
                        : 'bg-gray-500/10 text-gray-400 border-gray-700'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 tabular-nums">
                    {formatDate(user.created_at)}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditUser(user)}
                          disabled={isSelf(user)}
                          className="text-xs text-gray-400 hover:text-white font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={isSelf(user) || deleteUser.isPending}
                          className="text-xs text-red-400/70 hover:text-red-400 font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <UserFormModal onClose={() => setShowCreate(false)} />
      )}
      {editUser && (
        <UserFormModal user={editUser} onClose={() => setEditUser(null)} />
      )}
    </Layout>
  )
}
