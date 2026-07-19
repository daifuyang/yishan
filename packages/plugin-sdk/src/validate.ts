import type { PluginManifest } from './types.js'

export interface ValidationIssue {
  pluginId: string
  field: string
  message: string
}

const SEMVER_RE = /^\d+\.\d+\.\d+/
const SEMVER_RANGE_RE = /^[\^~]?\d+\.\d+\.\d+/
const PLUGIN_ID_RE = /^[\w-]+\/[\w-]+$/

export function validateManifest(manifest: PluginManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const push = (field: string, message: string) =>
    issues.push({ pluginId: manifest.id, field, message })

  if (!PLUGIN_ID_RE.test(manifest.id)) push('id', 'must match ^[\\w-]+/[\\w-]+$')
  if (!SEMVER_RE.test(manifest.version)) push('version', 'must be semver')
  if (!SEMVER_RANGE_RE.test(manifest.coreVersion)) push('coreVersion', 'must be semver range')
  if (!Array.isArray(manifest.permissions)) push('permissions', 'must be an array')
  if (!Array.isArray(manifest.menus)) push('menus', 'must be an array')

  const apiPrefix = manifest.api?.prefix
  if (apiPrefix !== undefined && !apiPrefix.startsWith('/api/')) {
    push('api.prefix', 'must start with /api/')
  }

  const expectedPrefix = `/api/plugins/${manifest.id}/v1`
  if (apiPrefix && apiPrefix !== expectedPrefix) {
    push('api.prefix', `must equal ${expectedPrefix} (derived from id)`)
  }

  return issues
}