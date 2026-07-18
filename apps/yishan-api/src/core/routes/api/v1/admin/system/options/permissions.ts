import { definePermissions } from '../../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:option:list', label: '系统选项-列表', group: 'system' },
  UPDATE: { code: 'system:option:update', label: '系统选项-更新', group: 'system' },
} as const);
