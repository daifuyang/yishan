/**
 * 数据库连接 URL 的唯一拼接实现（P0 M9：此前在 client、根与各模块 drizzle.config 中各写一份，
 * 默认值互不一致）。只读环境变量，不建连接，可被 drizzle-kit 配置文件直接导入。
 *
 *   DATABASE_URL 优先；否则在设置了 DATABASE_HOST 时用 DATABASE_USER / DATABASE_PASSWORD /
 *   DATABASE_PORT / DATABASE_NAME 拼接（用户名、密码做 URL 编码）。都没有时返回 undefined，
 *   由调用方决定兜底。
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.DATABASE_URL) return env.DATABASE_URL
  if (!env.DATABASE_HOST) return undefined
  const user = encodeURIComponent(env.DATABASE_USER ?? 'root')
  const password = encodeURIComponent(env.DATABASE_PASSWORD ?? '')
  const port = env.DATABASE_PORT ?? '3306'
  const database = env.DATABASE_NAME ?? ''
  return `mysql://${user}:${password}@${env.DATABASE_HOST}:${port}/${database}`
}

/** drizzle-kit 配置的本地开发兜底（未配置任何数据库环境变量时）。 */
export const LOCAL_DEV_DATABASE_URL = 'mysql://root:root@localhost:3306/yishan'
