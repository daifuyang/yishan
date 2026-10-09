export const DepartmentMessageKeys = {
  LIST_SUCCESS: 'LIST_SUCCESS',
  DETAIL_SUCCESS: 'DETAIL_SUCCESS',
  CREATE_SUCCESS: 'CREATE_SUCCESS',
  UPDATE_SUCCESS: 'UPDATE_SUCCESS',
  DELETE_SUCCESS: 'DELETE_SUCCESS',
  TREE_SUCCESS: 'TREE_SUCCESS',
} as const;

export type DepartmentMessageKey = typeof DepartmentMessageKeys[keyof typeof DepartmentMessageKeys];

const DEPARTMENT_MESSAGES = {
  'zh-CN': {
    LIST_SUCCESS: '获取部门列表成功',
    DETAIL_SUCCESS: '获取部门详情成功',
    CREATE_SUCCESS: '创建部门成功',
    UPDATE_SUCCESS: '更新部门成功',
    DELETE_SUCCESS: '删除部门成功',
    TREE_SUCCESS: '获取部门树成功',
  },
  'en-US': {
    LIST_SUCCESS: 'Fetched department list successfully',
    DETAIL_SUCCESS: 'Fetched department detail successfully',
    CREATE_SUCCESS: 'Department created successfully',
    UPDATE_SUCCESS: 'Department updated successfully',
    DELETE_SUCCESS: 'Department deleted successfully',
    TREE_SUCCESS: 'Fetched department tree successfully',
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof DEPARTMENT_MESSAGES {
  if (!acceptLanguage) return 'zh-CN';
  const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function getDepartmentMessage(key: DepartmentMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = DEPARTMENT_MESSAGES[locale];
  return bundle[key] || DEPARTMENT_MESSAGES['zh-CN'][key];
}