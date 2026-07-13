import { api } from './api'
import type { UserDto } from '@/types/auth'

export const authApi = {
  login: async (email: string, password: string): Promise<void> => {
    await api.post('/auth/login', { email, password })
    localStorage.setItem('loggedIn', '1')
  },

  me: (): Promise<UserDto> => api.get<UserDto>('/auth/me'),

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('loggedIn')
    }
  },
}
