import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/axios'
import type { ApiResponse, Flavor, MatchRules } from '@/types'

export interface FlavorInput {
  name: string
  priority: number
  is_default: boolean
  match: MatchRules
  response: {
    status: number
    headers: Record<string, string>
    body: Record<string, unknown>
    delay_ms: number
  }
}

const gatewayKey = (id: string) => ['gateways', id]

export function useCreateFlavor(gatewayId: string, endpointId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: FlavorInput) => {
      const { data } = await apiClient.post<ApiResponse<Flavor>>(
        `/admin/gateways/${gatewayId}/endpoints/${endpointId}/flavors`,
        input,
      )
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to create flavor')
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: gatewayKey(gatewayId) }),
  })
}

export function useUpdateFlavor(gatewayId: string, endpointId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fid, input }: { fid: string; input: Partial<FlavorInput> }) => {
      const { data } = await apiClient.put<ApiResponse<Flavor>>(
        `/admin/gateways/${gatewayId}/endpoints/${endpointId}/flavors/${fid}`,
        input,
      )
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to update flavor')
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: gatewayKey(gatewayId) }),
  })
}

export function useDeleteFlavor(gatewayId: string, endpointId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fid: string) => {
      await apiClient.delete(
        `/admin/gateways/${gatewayId}/endpoints/${endpointId}/flavors/${fid}`,
      )
      return fid
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: gatewayKey(gatewayId) }),
  })
}
