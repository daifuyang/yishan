export const RoleMessageKeys = {
  LIST_SUCCESS: 'LIST_SUCCESS',
  DETAIL_SUCCESS: 'DETAIL_SUCCESS',
  CREATE_SUCCESS: 'CREATE_SUCCESS',
  UPDATE_SUCCESS: 'UPDATE_SUCCESS',
  DELETE_SUCCESS: 'DELETE_SUCCESS',
} as const;

export type RoleMessageKey = typeof RoleMessageKeys[keyof typeof RoleMessageKeys];

const ROLE_MESSAGES = {
  'zh-CN': {
    LIST_SUCCESS: '获取角色列表成功',
    DETAIL_SUCCESS: '获取角色详情成功',
    CREATE_SUCCESS: '创建角色成功',
    UPDATE_SUCCESS: '更新角色成功',
    DELETE_SUCCESS: '删除角色成功',
  },
  'en-US': {
    LIST_SUCCESS: 'Fetched role list successfully',
    DETAIL_SUCCESS: 'Fetched role detail successfully',
    CREATE_SUCCESS: 'Role created successfully',
    UPDATE_SUCCESS: 'Role updated successfully',
    DELETE_SUCCESS: 'Role deleted successfully',
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof ROLE_MESSAGES {
  if (!acceptLanguage) return 'zh-CN';
  const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function getRoleMessage(key: RoleMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = ROLE_MESSAGES[locale];
  return bundle[key] || ROLE_MESSAGES['zh-CN'][key];
}