import { ManifestValidationResult, PluginManifest, PluginPermission } from './types'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const PLUGIN_ID_PATTERN = /^([a-z0-9][a-z0-9-]{1,30})\/([a-z0-9][a-z0-9-]{1,50})$/;
const DB_NAMESPACE_PATTERN = /^[a-z][a-z0-9_]{2,23}$/

/**
 * 校验单个权限对象。
 * 新方案要求：permissions 必须是对象数组，不兼容 string[]。
 */
function validatePermissionObject(perm: unknown, index: number, errors: string[]): boolean {
  if (!perm || typeof perm !== 'object') {
    errors.push(`manifest.permissions[${index}] must be an object`);
    return false;
  }

  const p = perm as Partial<PluginPermission>;

  if (!isNonEmptyString(p.code)) {
    errors.push(`manifest.permissions[${index}].code must be a non-empty string`);
  }

  if (!isNonEmptyString(p.label)) {
    errors.push(`manifest.permissions[${index}].label must be a non-empty string`);
  }

  if (p.description !== undefined && typeof p.description !== 'string') {
    errors.push(`manifest.permissions[${index}].description must be a string`);
  }

  if (p.group !== undefined && typeof p.group !== 'string') {
    errors.push(`manifest.permissions[${index}].group must be a string`);
  }

  return errors.length === 0 || !errors.some(e => e.includes(`permissions[${index}]`));
}

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

  if (value.menuRoot !== undefined && typeof value.menuRoot !== 'boolean') {
    errors.push('manifest.menuRoot must be a boolean when provided')
  }

  if (!isNonEmptyString(value.version)) {
    errors.push('manifest.version must be a non-empty string')
  }

  if (!isNonEmptyString(value.dbNamespace)) {
    errors.push('manifest.dbNamespace must be a non-empty string')
  } else if (!DB_NAMESPACE_PATTERN.test(value.dbNamespace)) {
    errors.push('manifest.dbNamespace must match /^[a-z][a-z0-9_]{2,23}$/')
  }

  if (value.compatRange !== undefined && !isNonEmptyString(value.compatRange)) {
    errors.push('manifest.compatRange must be a non-empty string when provided')
  }

  if (value.channels && (!Array.isArray(value.channels) || value.channels.some((item) => !isNonEmptyString(item)))) {
    errors.push('manifest.channels must be a string array when provided')
  }

  // 新方案：permissions 必须是数组，不兼容 string[]、对象、null
  // 缺失 permissions 字段也必须失败（插件必须显式声明权限）
  if (value.permissions === undefined) {
    errors.push('manifest.permissions is required and must be an array of structured permission objects');
  } else if (!Array.isArray(value.permissions)) {
    errors.push('manifest.permissions must be an array of structured permission objects');
  } else {
    const seenCodes = new Set<string>();
    for (let i = 0; i < value.permissions.length; i++) {
      const perm = value.permissions[i];
      // 拒绝旧格式 string[]
      if (typeof perm === 'string') {
        errors.push(`manifest.permissions[${i}] must be an object, not a string. Use { code, label, ... } format.`);
        continue;
      }
      // 校验对象格式
      validatePermissionObject(perm, i, errors);
      // 检测同一 manifest 内 code 重复
      if (perm && typeof perm === 'object' && (perm as PluginPermission).code) {
        const code = (perm as PluginPermission).code;
        if (seenCodes.has(code)) {
          errors.push(`manifest.permissions: duplicate code '${code}' in manifest`);
        }
        seenCodes.add(code);
      }
    }
  }

  if (value.menus) {
    const menusValid =
      Array.isArray(value.menus) &&
      value.menus.every((item) =>
        isNonEmptyString(item?.channel)
        && isNonEmptyString(item?.path)
        && isNonEmptyString(item?.name)
        && (item.permissionCodes === undefined || (Array.isArray(item.permissionCodes) && item.permissionCodes.every(isNonEmptyString)))
      )

    if (!menusValid) {
      errors.push('manifest.menus must contain { channel, path, name } and optional non-empty permissionCodes')
    } else {
      const declaredCodes = new Set(value.permissions?.map((permission) => permission.code) ?? []);
      for (const menu of value.menus) {
        for (const code of menu.permissionCodes ?? []) {
          if (!declaredCodes.has(code)) {
            errors.push(`menu ${menu.path} references undeclared permission '${code}'`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
