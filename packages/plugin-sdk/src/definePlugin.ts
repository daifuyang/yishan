import type { PluginManifest } from './types.js'

/**
 * Identity function used to give the plugin author type hints and a single
 * stable signature for the catalog parser to detect. The function is a no-op
 * at runtime — it returns the manifest object unchanged.
 */
export function definePlugin<T extends PluginManifest>(manifest: T): T {
  return manifest
}