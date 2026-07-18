import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:department:list', label: '部门管理-列表', group: 'system' },
  CREATE: { code: 'system:department:create', label: '部门管理-创建', group: 'system' },
  UPDATE: { code: 'system:department:update', label: '部门管理-更新', group: 'system' },
  DELETE: { code: 'system:department:delete', label: '部门管理-删除', group: 'system' },
} as const);
