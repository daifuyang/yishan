export const UserMessageKeys = {
  LIST_SUCCESS: 'LIST_SUCCESS',
  DETAIL_SUCCESS: 'DETAIL_SUCCESS',
  CREATE_SUCCESS: 'CREATE_SUCCESS',
  UPDATE_SUCCESS: 'UPDATE_SUCCESS',
  DELETE_SUCCESS: 'DELETE_SUCCESS',
} as const;

export type UserMessageKey = typeof UserMessageKeys[keyof typeof UserMessageKeys];

const USER_MESSAGES = {
  'zh-CN': {
    LIST_SUCCESS: '获取用户列表成功',
    DETAIL_SUCCESS: '获取用户详情成功',
    CREATE_SUCCESS: '创建用户成功',
    UPDATE_SUCCESS: '更新用户成功',
    DELETE_SUCCESS: '删除用户成功',
  },
  'en-US': {
    LIST_SUCCESS: 'Fetched user list successfully',
    DETAIL_SUCCESS: 'Fetched user detail successfully',
    CREATE_SUCCESS: 'User created successfully',
    UPDATE_SUCCESS: 'User updated successfully',
    DELETE_SUCCESS: 'User deleted successfully',
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof USER_MESSAGES {
  if (!acceptLanguage) return 'zh-CN';
  const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function getUserMessage(key: UserMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = USER_MESSAGES[locale];
  return bundle[key] || USER_MESSAGES['zh-CN'][key];
}