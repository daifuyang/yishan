import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:menu:list', label: '菜单管理-列表', group: 'system' },
  CREATE: { code: 'system:menu:create', label: '菜单管理-创建', group: 'system' },
  UPDATE: { code: 'system:menu:update', label: '菜单管理-更新', group: 'system' },
  DELETE: { code: 'system:menu:delete', label: '菜单管理-删除', group: 'system' },
} as const);
