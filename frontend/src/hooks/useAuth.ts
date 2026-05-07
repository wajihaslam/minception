import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import apiClient from '@/lib/axios'
import { clearToken, setToken } from '@/store/auth'
import type { ApiResponse, LoginRequest, LoginResponse } from '@/types'

export function useLogin() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const { data } = await apiClient.post<ApiResponse<LoginResponse>>(
        '/auth/login',
        credentials,
      )
      if (!data.success || !data.data) {
        throw new Error(data.error?.message ?? 'Login failed')
      }
      return data.data
    },
    onSuccess: (data) => {
      setToken(data.access_token)
      navigate('/gateways')
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()

  return () => {
    clearToken()
    navigate('/login')
  }
}
