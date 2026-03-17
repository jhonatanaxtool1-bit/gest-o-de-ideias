const TOKEN_KEY = 'obsidian_auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Drop-in replacement for `fetch` that:
 * 1. Injects `Authorization: Bearer <token>` header automatically
 * 2. Redirects to /login on 401 (session expired / invalid token)
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init?.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(input, { ...init, headers })

  if (res.status === 401) {
    removeToken()
    window.location.href = '/login'
    // Throw so the caller never processes a 401 body
    throw new Error('Sessão expirada. Redirecionando para o login…')
  }

  return res
}
