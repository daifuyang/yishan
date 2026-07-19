import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Wave 4 — release-artifact smoke test (PROPOSAL §6.1).
 *
 * `pnpm --filter yishan-api build:ts` must (a) compile every
 * `plugins/<v>/<s>/plugin.ts` to a CommonJS module under
 * `apps/yishan-api/dist/plugins/<v>/<s>/plugin.js` and (b) copy
 * `artifacts/plugin-catalog.json` to `apps/yishan-api/dist/artifacts/`.
 *
 * The test reruns the build script in-process so a stale artifact does
 * not pass the check.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, '..', '..', '..')
const DIST_ROOT = join(REPO_ROOT, 'apps', 'yishan-api', 'dist')
const DIST_PLUGINS = join(DIST_ROOT, 'plugins')
const DIST_ARTIFACTS = join(DIST_ROOT, 'artifacts')

function runBuild() {
  // Always run the script from the repo root so it sees plugins/<v>/<s>.
  execSync('node scripts/build-plugins.mjs', {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  })
}

describe('Wave 4: release artifact ships plugin source + catalog', () => {
  beforeAll(() => {
    runBuild()
  }, 120_000)

  it('compile script produces artifacts/plugin-catalog.json', () => {
    const target = join(DIST_ARTIFACTS, 'plugin-catalog.json')
    expect(existsSync(target)).toBe(true)
    const parsed = JSON.parse(readFileSync(target, 'utf8'))
    expect(Array.isArray(parsed.plugins)).toBe(true)
    expect(parsed.plugins.length).toBeGreaterThanOrEqual(1)
    expect(parsed.plugins[0].id).toMatch(/^[\w-]+\/[\w-]+$/)
  })

  it('compile script produces plugins/yishan/hello/plugin.js', () => {
    const target = join(DIST_PLUGINS, 'yishan', 'hello', 'plugin.js')
    expect(existsSync(target)).toBe(true)
  })

  it('compiled plugin.js is require()-able and exports a manifest default', () => {
    const target = join(DIST_PLUGINS, 'yishan', 'hello', 'plugin.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(target) as { default?: { id: string; version: string } }
    expect(mod.default?.id).toBe('yishan/hello')
    expect(typeof mod.default?.version).toBe('string')
    // semver shape
    expect(mod.default.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('artifact catalog matches source catalog', () => {
    const sourcePath = join(REPO_ROOT, 'artifacts', 'plugin-catalog.json')
    const targetPath = join(DIST_ARTIFACTS, 'plugin-catalog.json')
    const source = readFileSync(sourcePath, 'utf8')
    const target = readFileSync(targetPath, 'utf8')
    expect(target).toBe(source)
  })
})
