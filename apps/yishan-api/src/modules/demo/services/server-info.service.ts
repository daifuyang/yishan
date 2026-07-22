import os from 'node:os'

/**
 * server-info 服务：纯函数，不读 db。
 *
 * 演示"module 内也有不接触数据库的纯逻辑服务"。
 */

export interface ServerInfo {
  module: 'demo'
  nodeVersion: string
  hostname: string
  platform: string
  arch: string
  cpus: number
  memory: { total: number; free: number }
  uptimeSeconds: number
  pid: number
  env: string
  timestamp: string
}

export function getServerInfo(): ServerInfo {
  return {
    module: 'demo',
    nodeVersion: process.version,
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    memory: { total: os.totalmem(), free: os.freemem() },
    uptimeSeconds: process.uptime(),
    pid: process.pid,
    env: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
  }
}
