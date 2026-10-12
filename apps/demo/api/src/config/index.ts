import { resolve } from 'node:path'
import { createSystemConfig } from '@yishan/core-system-api'

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const root = resolve(__dirname, '../..')
  const connection = env.DATABASE_URL ?? (env.DATABASE_HOST
    ? `mysql://${encodeURIComponent(env.DATABASE_USER ?? 'root')}:${encodeURIComponent(env.DATABASE_PASSWORD ?? '')}@${env.DATABASE_HOST}:${env.DATABASE_PORT ?? '3306'}/${env.DATABASE_NAME ?? ''}`
    : undefined)
  if (!connection) throw new Error('Configure DATABASE_URL or DATABASE_HOST for Demo API')
  const system = createSystemConfig({ ...env, CACHE_NAMESPACE: env.CACHE_NAMESPACE ?? 'yishan:demo' }, root)
  return { connection, system, host: env.HOST ?? '0.0.0.0', port: Number(env.PORT ?? '3100') }
}

export type DemoConfig = ReturnType<typeof loadConfig>
