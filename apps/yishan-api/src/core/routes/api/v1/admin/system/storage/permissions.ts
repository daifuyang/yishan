import { definePermissions } from '../../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:storage:list', label: '存储管理-列表', group: 'system' },
  UPDATE: { code: 'system:storage:update', label: '存储管理-更新', group: 'system' },
} as const);
