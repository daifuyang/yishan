import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:dict:list', label: '字典管理-列表', group: 'system' },
  CREATE: { code: 'system:dict:create', label: '字典管理-创建', group: 'system' },
  UPDATE: { code: 'system:dict:update', label: '字典管理-更新', group: 'system' },
  DELETE: { code: 'system:dict:delete', label: '字典管理-删除', group: 'system' },
} as const);
