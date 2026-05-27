import type { ApiEnvelope, CliSession } from './types.js'

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

export async function apiRequest<T>(params: {
  session: CliSession
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  requireAuth?: boolean
}): Promise<ApiEnvelope<T>> {
  const { session, path, method = 'GET', body, query, requireAuth = false } = params

  if (requireAuth && !session.accessToken) {
    throw new Error('请先登录：yishan-api-cli auth login -u <username> -p <password>')
  }

  const response = await fetch(buildUrl(session.baseUrl, path, query), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })

  return parseEnvelope<T>(response)
}

export async function apiRequestFormData<T>(params: {
  session: CliSession
  path: string
  method?: 'POST' | 'PUT'
  formData: FormData
  query?: Record<string, string | number | undefined>
  requireAuth?: boolean
}): Promise<ApiEnvelope<T>> {
  const { session, path, method = 'POST', formData, query, requireAuth = false } = params

  if (requireAuth && !session.accessToken) {
    throw new Error('请先登录：yishan-api-cli auth login -u <username> -p <password>')
  }

  const response = await fetch(buildUrl(session.baseUrl, path, query), {
    method,
    headers: {
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {})
    },
    body: formData
  })

  return parseEnvelope<T>(response)
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text()
  let payload: ApiEnvelope<T> | null = null
  try {
    payload = JSON.parse(text) as ApiEnvelope<T>
  } catch {
    throw new Error(`接口返回非 JSON：HTTP ${response.status} ${response.statusText}`)
  }

  if (!response.ok || !payload.success) {
    const details = payload.error ? ` (${payload.error})` : ''
    throw new Error(`请求失败 [${payload.code}] ${payload.message}${details}`)
  }

  return payload
}
