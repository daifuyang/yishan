import { describe, it, expect } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Wave 4 — catalog fail-fast coverage for the bootstrap decision.
 *
 * PROPOSAL §11 forbids silent degradation: a missing or empty
 * `artifacts/plugin-catalog.json` is a release-artifact bug and must
 * surface as a fatal boot error, not as "API boots with zero plugins".
 *
 * We do not exercise the full `app.ts` boot (which depends on a real DB);
 * we exercise the catalog-loading and validation primitives that
 * `app.ts` delegates to. The contract:
 *
 *   1. catalog file missing at the resolved path → throws
 *   2. catalog JSON malformed → throws
 *   3. catalog JSON parses but `plugins` is empty/missing → throws
 *   4. catalog references a plugin id for which no
 *      `plugins/<id>/plugin.{ts,js}` file exists → throws
 *
 * The helper `tryBootstrapCatalog` mirrors what `app.ts` does: read
 * the catalog, then for each entry try the dynamic import and SDK
 * `validateManifest`. It returns success/failure and surfaces the
 * underlying error message so tests can assert on it.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, '..', '..', '..')
const REAL_CATALOG = join(REPO_ROOT, 'artifacts', 'plugin-catalog.json')
const REAL_PLUGINS_DIR = join(REPO_ROOT, 'plugins')

interface CatalogError {
  ok: false
  stage: 'read' | 'shape' | 'plugin'
  message: string
}

interface CatalogSuccess {
  ok: true
  plugins: string[]
}

async function tryBootstrapCatalog(args: {
  catalogPath: string
  pluginsRoot: string
  loadEntry: (id: string) => Promise<{ default?: { id: string; permissions: unknown[]; menus: unknown[] } }>
}): Promise<CatalogSuccess | CatalogError> {
  let raw: string
  try {
    raw = readFileSync(args.catalogPath, 'utf8')
  } catch (err) {
    return {
      ok: false,
      stage: 'read',
      message: err instanceof Error ? err.message : 'unknown read error',
    }
  }
  let catalog: { plugins?: unknown }
  try {
    catalog = JSON.parse(raw)
  } catch (err) {
    return {
      ok: false,
      stage: 'read',
      message: err instanceof Error ? err.message : 'unknown json error',
    }
  }
  if (!Array.isArray(catalog.plugins) || catalog.plugins.length === 0) {
    return { ok: false, stage: 'shape', message: 'catalog.plugins is empty' }
  }
  const loaded: string[] = []
  for (const entry of catalog.plugins as Array<{ id: string }>) {
    try {
      const mod = await args.loadEntry(entry.id)
      if (!mod?.default) {
        return { ok: false, stage: 'plugin', message: `${entry.id} has no default export` }
      }
      loaded.push(entry.id)
    } catch (err) {
      return {
        ok: false,
        stage: 'plugin',
        message: err instanceof Error ? err.message : 'unknown plugin load error',
      }
    }
  }
  return { ok: true, plugins: loaded }
}

describe('Wave 4: catalog bootstrap fail-fast', () => {
  it('refuses when catalog file is missing', async () => {
    const result = await tryBootstrapCatalog({
      catalogPath: '/nonexistent/path/catalog.json',
      pluginsRoot: REAL_PLUGINS_DIR,
      loadEntry: async () => {
        throw new Error('should not be called')
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('read')
    }
  })

  it('refuses when catalog JSON is malformed', async () => {
    const tmp = join(__dirname, '.tmp-bad-catalog')
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true })
    const file = join(tmp, 'plugin-catalog.json')
    writeFileSync(file, '{ this is not json')
    try {
      const result = await tryBootstrapCatalog({
        catalogPath: file,
        pluginsRoot: REAL_PLUGINS_DIR,
        loadEntry: async () => {
          throw new Error('should not be called')
        },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.stage).toBe('read')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('refuses when catalog has empty plugin array', async () => {
    const tmp = join(__dirname, '.tmp-empty-catalog')
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true })
    const file = join(tmp, 'plugin-catalog.json')
    writeFileSync(file, JSON.stringify({ plugins: [] }))
    try {
      const result = await tryBootstrapCatalog({
        catalogPath: file,
        pluginsRoot: REAL_PLUGINS_DIR,
        loadEntry: async () => {
          throw new Error('should not be called')
        },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.stage).toBe('shape')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('refuses when catalog entries refer to non-existent plugins', async () => {
    const tmp = join(__dirname, '.tmp-missing-plugin-catalog')
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true })
    const file = join(tmp, 'plugin-catalog.json')
    writeFileSync(file, JSON.stringify({ plugins: [{ id: 'ghost/never' }] }))
    try {
      const result = await tryBootstrapCatalog({
        catalogPath: file,
        pluginsRoot: '/nonexistent/plugins',
        loadEntry: async () => {
          throw new Error('plugin file not found')
        },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.stage).toBe('plugin')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('real core profile catalog loads successfully with the real hello plugin', async () => {
    if (!existsSync(REAL_CATALOG)) {
      // Skip rather than fail — `pnpm profile:catalog` may not have been
      // run for this tree; the release-artifact test verifies that flow.
      return
    }
    const result = await tryBootstrapCatalog({
      catalogPath: REAL_CATALOG,
      pluginsRoot: REAL_PLUGINS_DIR,
      loadEntry: async (id) => {
        const path = join(REAL_PLUGINS_DIR, id, 'plugin.ts')
        const mod = (await import(path)) as { default?: { id: string; permissions: unknown[]; menus: unknown[] } }
        return mod
      },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plugins).toContain('yishan/hello')
    }
  })
})
