import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import apiClient from '@/lib/axios'
import type { ApiResponse, Gateway } from '@/types'

const GATEWAYS_KEY = ['gateways']

interface GatewayInput {
  name: string
  base_path: string
  description: string
  is_active: boolean
}

async function fetchGateways(): Promise<Gateway[]> {
  const { data } = await apiClient.get<ApiResponse<{ gateways: Gateway[] }>>('/gateways')
  if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to load gateways')
  return data.data.gateways
}

async function fetchGateway(id: string): Promise<Gateway> {
  const { data } = await apiClient.get<ApiResponse<{ gateway: Gateway }>>(`/gateways/${id}`)
  if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Gateway not found')
  return data.data.gateway
}

export function useGateways() {
  return useQuery({
    queryKey: GATEWAYS_KEY,
    queryFn: fetchGateways,
  })
}

export function useGateway(id: string) {
  return useQuery({
    queryKey: [...GATEWAYS_KEY, id],
    queryFn: () => fetchGateway(id),
    enabled: !!id,
  })
}

export function useCreateGateway() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: GatewayInput) => {
      const { data } = await apiClient.post<ApiResponse<{ gateway: Gateway }>>('/gateways', input)
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to create gateway')
      return data.data.gateway
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GATEWAYS_KEY })
    },
  })
}

export function useUpdateGateway() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<GatewayInput> }) => {
      const { data } = await apiClient.put<ApiResponse<{ gateway: Gateway }>>(`/gateways/${id}`, input)
      if (!data.success || !data.data) throw new Error(data.error?.message ?? 'Failed to update gateway')
      return data.data.gateway
    },
    onSuccess: (gateway) => {
      queryClient.invalidateQueries({ queryKey: GATEWAYS_KEY })
      queryClient.invalidateQueries({ queryKey: [...GATEWAYS_KEY, gateway.id] })
    },
  })
}

export function useDeleteGateway() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/gateways/${id}`)
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: GATEWAYS_KEY })
      queryClient.removeQueries({ queryKey: [...GATEWAYS_KEY, id] })
      navigate('/gateways')
    },
  })
}
