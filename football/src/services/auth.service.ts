import { api } from './api'
import type { LoginResponse, UserDto } from '@/types/auth'

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as Record<string, unknown>
  } catch {
    return {}
  }
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await api.post<LoginResponse>('/auth/login', { email, password })
    localStorage.setItem('accessToken', res.accessToken)
    localStorage.setItem('refreshToken', res.refreshToken)
    return res
  },

  // JWT payload에서 id를 추출해 /auth/:id 로 사용자 정보 조회
  me: async (): Promise<UserDto> => {
    const token = localStorage.getItem('accessToken')
    if (!token) throw new Error('no_token')
    const payload = decodeJwtPayload(token)
    const id = payload['id'] as number
    return api.get<UserDto>(`/auth/${id}`)
  },

  logout: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  },
}
