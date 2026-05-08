import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/axios'
import type { ApiResponse, User } from '@/types'

export const USERS_KEY = ['users']

export interface CreateUserInput {
  username: string
  email: string
  password: string
  role: User['role']
  is_active: boolean
}

export interface UpdateUserInput {
  email?: string
  role?: User['role']
  is_active?: boolean
}

async function fetchUsers(): Promise<User[]> {
  const { data } = await apiClient.get<ApiResponse<User[]>>('/admin/users/')
  if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to load users')
  return data.data
}

export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: fetchUsers })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data } = await apiClient.post<ApiResponse<User>>('/admin/users/', input)
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to create user')
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateUserInput }) => {
      const { data } = await apiClient.put<ApiResponse<User>>(`/admin/users/${id}`, input)
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to update user')
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/users/${id}`)
      return id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}
