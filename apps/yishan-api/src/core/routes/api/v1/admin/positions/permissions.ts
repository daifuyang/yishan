import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:position:list', label: '岗位管理-列表', group: 'system' },
  CREATE: { code: 'system:position:create', label: '岗位管理-创建', group: 'system' },
  UPDATE: { code: 'system:position:update', label: '岗位管理-更新', group: 'system' },
  DELETE: { code: 'system:position:delete', label: '岗位管理-删除', group: 'system' },
} as const);
