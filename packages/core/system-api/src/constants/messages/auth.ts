export const AuthMessageKeys = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT_SUCCESS: 'LOGOUT_SUCCESS',
  USER_INFO_SUCCESS: 'USER_INFO_SUCCESS',
  REFRESH_SUCCESS: 'REFRESH_SUCCESS',
} as const;

export type AuthMessageKey = typeof AuthMessageKeys[keyof typeof AuthMessageKeys];

const AUTH_MESSAGES = {
  'zh-CN': {
    LOGIN_SUCCESS: '登录成功',
    LOGOUT_SUCCESS: '登出成功',
    USER_INFO_SUCCESS: '获取用户信息成功',
    REFRESH_SUCCESS: '令牌刷新成功',
  },
  'en-US': {
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    USER_INFO_SUCCESS: 'Fetched user info successfully',
    REFRESH_SUCCESS: 'Token refreshed successfully',
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof AUTH_MESSAGES {
  if (!acceptLanguage) return 'zh-CN';
  const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function getAuthMessage(key: AuthMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = AUTH_MESSAGES[locale];
  return bundle[key] || AUTH_MESSAGES['zh-CN'][key];
}