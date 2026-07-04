const BASE_URL = '/api'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

let refreshingPromise: Promise<string> | null = null

let pendingCount = 0
const pendingListeners = new Set<(pending: boolean) => void>()
const notifyPending = () => {
  const pending = pendingCount > 0
  pendingListeners.forEach((l) => l(pending))
}
export function subscribeApiPending(listener: (pending: boolean) => void): () => void {
  pendingListeners.add(listener)
  listener(pendingCount > 0)
  return () => {
    pendingListeners.delete(listener)
  }
}

async function tryRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) throw new Error('no_refresh_token')

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) throw new Error('refresh_failed')

  const tokens = (await res.json()) as { accessToken: string; refreshToken: string }
  localStorage.setItem('accessToken', tokens.accessToken)
  localStorage.setItem('refreshToken', tokens.refreshToken)
  return tokens.accessToken
}

export function forceLogout() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('currentUser')
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

async function doFetch(
  method: HttpMethod,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  pendingCount++
  notifyPending()
  try {
    const token = localStorage.getItem('accessToken')
    let res = await doFetch(method, path, token, body)

    if (res.status === 401) {
      try {
        if (!refreshingPromise) {
          refreshingPromise = tryRefresh().finally(() => {
            refreshingPromise = null
          })
        }
        const newToken = await refreshingPromise
        res = await doFetch(method, path, newToken, body)
      } catch {
        forceLogout()
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.')
      }
    }

    if (res.status === 401) {
      forceLogout()
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.')
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: '서버 오류가 발생했습니다.' }))
      throw new Error((error as { message: string }).message)
    }

    if (res.status === 204) {
      return undefined as T
    }

    return (await res.json()) as T
  } finally {
    pendingCount = Math.max(0, pendingCount - 1)
    notifyPending()
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
