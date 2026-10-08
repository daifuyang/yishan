import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanDiskModulesPure } from '../src/core/module-loader/module-loader.js'

function writeModule(distRoot: string, id: string, enabled?: boolean) {
  const dir = join(distRoot, 'modules', id)
  mkdirSync(dir, { recursive: true })
  const enabledField = enabled === undefined ? '' : `, enabled: ${enabled}`
  writeFileSync(join(dir, 'module.js'), `exports.meta = { id: '${id}'${enabledField} }\n`)
}

describe('scanDiskModulesPure pack switch', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('skips modules with meta.enabled === false and keeps the rest', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yishan-mod-'))
    dirs.push(root)
    const distRoot = join(root, 'dist')
    const srcRoot = join(root, 'src')
    writeModule(distRoot, 'shop', true)
    writeModule(distRoot, 'hidden', false)
    writeModule(distRoot, 'demo')

    const scanned = await scanDiskModulesPure(srcRoot, distRoot)
    expect(scanned.map((m) => m.id)).toEqual(['demo', 'shop'])
    expect(scanned.every((m) => !('enabled' in m))).toBe(true)
  })
})
