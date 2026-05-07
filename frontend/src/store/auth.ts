import type { TokenPayload } from '@/types'

const TOKEN_KEY = 'minception_token'

function decodePayload(token: string): TokenPayload | null {
  try {
    const base64 = token.split('.')[1]
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as TokenPayload
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false
  const payload = decodePayload(token)
  if (!payload) return false
  return payload.exp * 1000 > Date.now()
}

export function getTokenPayload(): TokenPayload | null {
  const token = getToken()
  if (!token) return null
  return decodePayload(token)
}
