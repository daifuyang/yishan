export const PageMessageKeys = {
  LIST_SUCCESS: 'LIST_SUCCESS',
  DETAIL_SUCCESS: 'DETAIL_SUCCESS',
  CREATE_SUCCESS: 'CREATE_SUCCESS',
  UPDATE_SUCCESS: 'UPDATE_SUCCESS',
  DELETE_SUCCESS: 'DELETE_SUCCESS',
} as const;

export type PageMessageKey = typeof PageMessageKeys[keyof typeof PageMessageKeys];

const PAGE_MESSAGES = {
  'zh-CN': {
    LIST_SUCCESS: '获取页面列表成功',
    DETAIL_SUCCESS: '获取页面详情成功',
    CREATE_SUCCESS: '创建页面成功',
    UPDATE_SUCCESS: '更新页面成功',
    DELETE_SUCCESS: '删除页面成功',
  },
  'en-US': {
    LIST_SUCCESS: 'Fetched page list successfully',
    DETAIL_SUCCESS: 'Fetched page detail successfully',
    CREATE_SUCCESS: 'Page created successfully',
    UPDATE_SUCCESS: 'Page updated successfully',
    DELETE_SUCCESS: 'Page deleted successfully',
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof PAGE_MESSAGES {
  if (!acceptLanguage) return 'zh-CN';
  const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function getPageMessage(key: PageMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = PAGE_MESSAGES[locale];
  return bundle[key] || PAGE_MESSAGES['zh-CN'][key];
}

