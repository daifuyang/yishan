import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:user:list', label: '用户管理-列表', group: 'system' },
  CREATE: { code: 'system:user:create', label: '用户管理-创建', group: 'system' },
  UPDATE: { code: 'system:user:update', label: '用户管理-更新', group: 'system' },
  DELETE: { code: 'system:user:delete', label: '用户管理-删除', group: 'system' },
} as const);
