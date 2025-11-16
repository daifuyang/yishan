export const PostMessageKeys = {
  LIST_SUCCESS: 'LIST_SUCCESS',
  DETAIL_SUCCESS: 'DETAIL_SUCCESS',
  CREATE_SUCCESS: 'CREATE_SUCCESS',
  UPDATE_SUCCESS: 'UPDATE_SUCCESS',
  DELETE_SUCCESS: 'DELETE_SUCCESS',
} as const;

export type PostMessageKey = typeof PostMessageKeys[keyof typeof PostMessageKeys];

const POST_MESSAGES = {
  'zh-CN': {
    LIST_SUCCESS: '获取岗位列表成功',
    DETAIL_SUCCESS: '获取岗位详情成功',
    CREATE_SUCCESS: '创建岗位成功',
    UPDATE_SUCCESS: '更新岗位成功',
    DELETE_SUCCESS: '删除岗位成功',
  },
  'en-US': {
    LIST_SUCCESS: 'Fetched position list successfully',
    DETAIL_SUCCESS: 'Fetched position detail successfully',
    CREATE_SUCCESS: 'Position created successfully',
    UPDATE_SUCCESS: 'Position updated successfully',
    DELETE_SUCCESS: 'Position deleted successfully',
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof POST_MESSAGES {
  if (!acceptLanguage) return 'zh-CN';
  const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function getPostMessage(key: PostMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = POST_MESSAGES[locale];
  return bundle[key] || POST_MESSAGES['zh-CN'][key];
}