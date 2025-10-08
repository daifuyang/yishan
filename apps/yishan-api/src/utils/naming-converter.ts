/**
 * 命名转换工具类
 * 提供下划线命名(snake_case)与小驼峰命名(camelCase)之间的相互转换
 */

/**
 * 将下划线命名转换为小驼峰命名
 * @param str - 下划线命名字符串
 * @returns 小驼峰命名字符串
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 将小驼峰命名转换为下划线命名
 * @param str - 小驼峰命名字符串
 * @returns 下划线命名字符串
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * 深度转换对象属性的命名风格
 * @param obj - 要转换的对象
 * @param converter - 转换函数
 * @returns 转换后的对象
 */
function deepConvertKeys(obj: any, converter: (key: string) => string): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepConvertKeys(item, converter));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = converter(key);
      result[newKey] = deepConvertKeys(value, converter);
    }
    return result;
  }

  return obj;
}

/**
 * 将对象的属性名从下划线命名转换为小驼峰命名
 * @param obj - 要转换的对象
 * @returns 转换后的对象
 */
export function convertKeysToCamel(obj: any): any {
  return deepConvertKeys(obj, snakeToCamel);
}

/**
 * 将对象的属性名从小驼峰命名转换为下划线命名
 * @param obj - 要转换的对象
 * @returns 转换后的对象
 */
export function convertKeysToSnake(obj: any): any {
  return deepConvertKeys(obj, camelToSnake);
}

/**
 * 创建一个新的对象，排除指定的属性
 * @param obj - 源对象
 * @param keysToExclude - 要排除的属性名数组
 * @returns 新对象
 */
export function excludeKeys(obj: any, keysToExclude: string[]): any {
  const result = { ...obj };
  for (const key of keysToExclude) {
    delete result[key];
  }
  return result;
}

/**
 * 转换用户对象为公开信息（包含命名转换）
 * @param user - 用户对象
 * @returns 转换后的用户公开信息
 */
export function convertUserToPublic(user: any): any {
  if (!user) return null;
  
  // 排除敏感字段
  const sensitiveFields = ['password_hash', 'salt', 'deleted_at', 'version'];
  const publicUser = excludeKeys(user, sensitiveFields);
  
  // 转换为小驼峰命名
  return convertKeysToCamel(publicUser);
}

/**
 * 转换用户列表为公开信息（包含命名转换）
 * @param users - 用户对象数组
 * @returns 转换后的用户公开信息数组
 */
export function convertUsersToPublic(users: any[]): any[] {
  return users.map(user => convertUserToPublic(user)).filter(Boolean);
}