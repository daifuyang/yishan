import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { validateManifest } from './manifest'
import { LoadedPluginManifest, PluginManifest } from './types'

const MANIFEST_FILE_CANDIDATES = ['manifest.ts', 'manifest.js', 'manifest.mts', 'manifest.cts']

function resolveManifestPath(moduleRoot: string): string | undefined {
  for (const fileName of MANIFEST_FILE_CANDIDATES) {
    const candidate = join(moduleRoot, fileName)
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

export function loadPluginManifests(modulesDir: string): LoadedPluginManifest[] {
  if (!existsSync(modulesDir)) {
    return []
  }

  const moduleNames = readdirSync(modulesDir).filter((name) => statSync(join(modulesDir, name)).isDirectory())
  const loaded: LoadedPluginManifest[] = []

  for (const moduleName of moduleNames) {
    const moduleRoot = join(modulesDir, moduleName)
    const manifestPath = resolveManifestPath(moduleRoot)
    if (!manifestPath) {
      continue
    }

    const mod = require(manifestPath) as { default?: unknown }
    const manifest = (mod.default ?? mod) as PluginManifest
    const validation = validateManifest(manifest)
    if (!validation.valid) {
      continue
    }

    loaded.push({
      moduleName,
      manifestPath,
      manifest
    })
  }

  return loaded
}
