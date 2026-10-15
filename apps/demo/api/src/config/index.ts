import { resolve } from 'node:path'
import { isIP } from 'node:net'
import { createSystemConfig } from '@yishan/core-system-api'

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const root = resolve(__dirname, '../..')
  const connection = env.DATABASE_URL ?? (env.DATABASE_HOST
    ? `mysql://${encodeURIComponent(env.DATABASE_USER ?? 'root')}:${encodeURIComponent(env.DATABASE_PASSWORD ?? '')}@${env.DATABASE_HOST}:${env.DATABASE_PORT ?? '3306'}/${env.DATABASE_NAME ?? ''}`
    : undefined)
  if (!connection) throw new Error('Configure DATABASE_URL or DATABASE_HOST for Demo API')
  const trustProxy: false | string[] = env.TRUST_PROXY_IPS?.trim()
    ? env.TRUST_PROXY_IPS.split(',').map(value => value.trim())
    : false
  if (trustProxy) {
    for (const value of trustProxy) {
      const [address, prefix, extra] = value.split('/')
      const family = isIP(address)
      if (!family || extra !== undefined || (prefix !== undefined && (
        !/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (family === 4 ? 32 : 128)
      ))) throw new Error('TRUST_PROXY_IPS must contain explicit IP addresses or CIDRs; unrestricted proxy trust is not allowed')
    }
  }
  const system = createSystemConfig({ ...env, CACHE_NAMESPACE: env.CACHE_NAMESPACE ?? 'yishan:demo' }, root)
  return { connection, system, trustProxy, host: env.HOST ?? '0.0.0.0', port: Number(env.PORT ?? '3100') }
}

export type DemoConfig = ReturnType<typeof loadConfig>
