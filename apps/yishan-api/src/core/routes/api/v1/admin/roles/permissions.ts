import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:role:list', label: '角色管理-列表', group: 'system' },
  CREATE: { code: 'system:role:create', label: '角色管理-创建', group: 'system' },
  UPDATE: { code: 'system:role:update', label: '角色管理-更新', group: 'system' },
  DELETE: { code: 'system:role:delete', label: '角色管理-删除', group: 'system' },
  GRANT: { code: 'system:role:grant', label: '角色管理-授权', group: 'system' },
} as const);
