import i18n from '@/i18n'

const BASE_URL = '/api'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

let refreshingPromise: Promise<void> | null = null

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

async function tryRefresh(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('refresh_failed')
}

export function forceLogout() {
  localStorage.removeItem('loggedIn')
  localStorage.removeItem('userRole')
  localStorage.removeItem('superAdminTeamId')
  localStorage.removeItem('superAdminClubName')
  localStorage.removeItem('superAdminTeamName')
  localStorage.removeItem('superAdminTeamType')
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

function getSuperAdminHeaders(): Record<string, string> {
  const teamId = localStorage.getItem('superAdminTeamId')
  return teamId ? { 'X-Team-Id': teamId } : {}
}

async function doFetch(method: HttpMethod, path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getSuperAdminHeaders() },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  pendingCount++
  notifyPending()
  try {
    let res = await doFetch(method, path, body)

    if (res.status === 401) {
      try {
        if (!refreshingPromise) {
          refreshingPromise = tryRefresh().finally(() => {
            refreshingPromise = null
          })
        }
        await refreshingPromise
        res = await doFetch(method, path, body)
      } catch {
        forceLogout()
        throw new Error(i18n.t('common:loginPage.apiError.authExpired'))
      }
    }

    if (res.status === 401) {
      forceLogout()
      throw new Error(i18n.t('common:loginPage.apiError.authExpired'))
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: i18n.t('common:loginPage.apiError.serverError') }))
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

async function requestForm<T>(method: 'POST' | 'PATCH', path: string, form: FormData): Promise<T> {
  pendingCount++
  notifyPending()
  try {
    const doForm = () =>
      fetch(`${BASE_URL}${path}`, { method, credentials: 'include', body: form, headers: getSuperAdminHeaders() })
    let res = await doForm()
    if (res.status === 401) {
      try {
        if (!refreshingPromise) {
          refreshingPromise = tryRefresh().finally(() => { refreshingPromise = null })
        }
        await refreshingPromise
        res = await doForm()
      } catch {
        forceLogout()
        throw new Error(i18n.t('common:loginPage.apiError.authExpired'))
      }
    }
    if (res.status === 401) { forceLogout(); throw new Error(i18n.t('common:loginPage.apiError.authExpired')) }
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: i18n.t('common:loginPage.apiError.serverError') }))
      throw new Error((error as { message: string }).message)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  } finally {
    pendingCount = Math.max(0, pendingCount - 1)
    notifyPending()
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  postForm: <T>(path: string, form: FormData) => requestForm<T>('POST', path, form),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  patchForm: <T>(path: string, form: FormData) => requestForm<T>('PATCH', path, form),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
