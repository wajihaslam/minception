import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/axios'
import type { ApiResponse, Endpoint } from '@/types'

export interface EndpointInput {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  description: string
}

const gatewayKey = (id: string) => ['gateways', id]

export function useCreateEndpoint(gatewayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EndpointInput) => {
      const { data } = await apiClient.post<ApiResponse<Endpoint>>(
        `/admin/gateways/${gatewayId}/endpoints`,
        input,
      )
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to create endpoint')
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: gatewayKey(gatewayId) }),
  })
}

export function useUpdateEndpoint(gatewayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ eid, input }: { eid: string; input: Partial<EndpointInput> }) => {
      const { data } = await apiClient.put<ApiResponse<Endpoint>>(
        `/admin/gateways/${gatewayId}/endpoints/${eid}`,
        input,
      )
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to update endpoint')
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: gatewayKey(gatewayId) }),
  })
}

export function useDeleteEndpoint(gatewayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eid: string) => {
      await apiClient.delete(`/admin/gateways/${gatewayId}/endpoints/${eid}`)
      return eid
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: gatewayKey(gatewayId) }),
  })
}
