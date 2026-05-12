export interface MatchRules {
  headers?: Record<string, string>
  body?: Record<string, string>
  query?: Record<string, string>
}

export type ParamSource = 'request.header' | 'request.body' | 'request.query' | 'datetime'
export type DatetimeFormat = 'iso' | 'unix' | 'date' | 'time'
export type ConditionOperator = 'eq' | 'neq' | 'contains' | 'matches'

export interface FlavorParam {
  name: string
  source: ParamSource
  key: string  // header key | jsonpath | query key | DatetimeFormat
}

export interface FlavorConditionResponse {
  status?: number
  headers?: Record<string, string>
  body?: Record<string, unknown>
}

export interface FlavorCondition {
  param: string
  operator: ConditionOperator
  value: string
  response: FlavorConditionResponse
}

export interface Flavor {
  id: string
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
  params?: FlavorParam[]
  conditions?: FlavorCondition[]
}

export interface Endpoint {
  id: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  description: string
  is_active: boolean
  flavors: Flavor[]
}

export interface Gateway {
  id: string
  name: string
  base_path: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
  endpoints: Endpoint[]
}

export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  is_active: boolean
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface ApiError {
  code: string
  message: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
}

export interface TokenPayload {
  sub: string
  role: 'admin' | 'editor' | 'viewer'
  exp: number
}
