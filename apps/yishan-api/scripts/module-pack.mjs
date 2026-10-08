/**
 * 装载开关：只认 module.ts / module.js 里 `export const meta = { enabled: false }`。
 * 缺省或 true 都算装载。构建、Admin 扫描、onboard 共用这一段。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function isModulePackedFromSource(src) {
  const block = src.match(/export\s+const\s+meta\s*=\s*\{([\s\S]*?)\}/)
  if (!block) return true
  return !/\benabled\s*:\s*false\b/.test(block[1])
}

export function isPackedModuleDir(dir) {
  const ts = join(dir, 'module.ts')
  const js = join(dir, 'module.js')
  const file = existsSync(ts) ? ts : existsSync(js) ? js : null
  if (!file) return false
  return isModulePackedFromSource(readFileSync(file, 'utf8'))
}
