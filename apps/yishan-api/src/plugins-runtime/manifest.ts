import { ManifestValidationResult, PluginManifest } from './types'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const PLUGIN_ID_PATTERN = /^([a-z0-9][a-z0-9-]{1,30})\/([a-z0-9][a-z0-9-]{1,50})$/;

export function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: string[] = []
  const value = manifest as Partial<PluginManifest> | null

  if (!value || typeof value !== 'object') {
    return { valid: false, errors: ['manifest must be an object'] }
  }

  if (!isNonEmptyString(value.pluginId)) {
    errors.push('manifest.pluginId must be a non-empty string in format org/plugin')
  } else if (!PLUGIN_ID_PATTERN.test(value.pluginId)) {
    errors.push('manifest.pluginId must match format org/plugin (e.g., yishan/hello)')
  }

  if (value.pluginId && value.menus && Array.isArray(value.menus)) {
    const pluginIdMatch = value.pluginId.match(PLUGIN_ID_PATTERN);
    if (pluginIdMatch) {
      const [, org, slug] = pluginIdMatch;
      const expectedPathPrefix = `/plugins/${org}/${slug}`;
      for (const menu of value.menus) {
        if (menu.path && !menu.path.startsWith(expectedPathPrefix)) {
          errors.push(`menu path "${menu.path}" must start with "${expectedPathPrefix}"`);
        }
      }
    }
  }

  if (!isNonEmptyString(value.name)) {
    errors.push('manifest.name must be a non-empty string')
  }

  if (!isNonEmptyString(value.version)) {
    errors.push('manifest.version must be a non-empty string')
  }

  if (value.compatRange !== undefined && !isNonEmptyString(value.compatRange)) {
    errors.push('manifest.compatRange must be a non-empty string when provided')
  }

  if (value.channels && (!Array.isArray(value.channels) || value.channels.some((item) => !isNonEmptyString(item)))) {
    errors.push('manifest.channels must be a string array when provided')
  }

  if (value.permissions && (!Array.isArray(value.permissions) || value.permissions.some((item) => !isNonEmptyString(item)))) {
    errors.push('manifest.permissions must be a string array when provided')
  }

  if (value.menus) {
    const menusValid =
      Array.isArray(value.menus) &&
      value.menus.every((item) => isNonEmptyString(item?.channel) && isNonEmptyString(item?.path) && isNonEmptyString(item?.name))

    if (!menusValid) {
      errors.push('manifest.menus must contain { channel, path, name } with non-empty strings')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
