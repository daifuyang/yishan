export const MenuMessageKeys = {
  LIST_SUCCESS: 'LIST_SUCCESS',
  DETAIL_SUCCESS: 'DETAIL_SUCCESS',
  CREATE_SUCCESS: 'CREATE_SUCCESS',
  UPDATE_SUCCESS: 'UPDATE_SUCCESS',
  DELETE_SUCCESS: 'DELETE_SUCCESS',
  TREE_SUCCESS: 'TREE_SUCCESS',
  AUTH_PATHS_SUCCESS: 'AUTH_PATHS_SUCCESS',
} as const;

export type MenuMessageKey = typeof MenuMessageKeys[keyof typeof MenuMessageKeys];

const MENU_MESSAGES = {
  'zh-CN': {
    LIST_SUCCESS: '获取菜单列表成功',
    DETAIL_SUCCESS: '获取菜单详情成功',
    CREATE_SUCCESS: '创建菜单成功',
    UPDATE_SUCCESS: '更新菜单成功',
    DELETE_SUCCESS: '删除菜单成功',
    TREE_SUCCESS: '获取菜单树成功',
    AUTH_PATHS_SUCCESS: '获取授权路径成功',
  },
  'en-US': {
    LIST_SUCCESS: 'Fetched menu list successfully',
    DETAIL_SUCCESS: 'Fetched menu detail successfully',
    CREATE_SUCCESS: 'Menu created successfully',
    UPDATE_SUCCESS: 'Menu updated successfully',
    DELETE_SUCCESS: 'Menu deleted successfully',
    TREE_SUCCESS: 'Fetched menu tree successfully',
    AUTH_PATHS_SUCCESS: 'Fetched authorized paths successfully',
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof MENU_MESSAGES {
  if (!acceptLanguage) return 'zh-CN';
  const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function getMenuMessage(key: MenuMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = MENU_MESSAGES[locale];
  return bundle[key] || MENU_MESSAGES['zh-CN'][key];
}