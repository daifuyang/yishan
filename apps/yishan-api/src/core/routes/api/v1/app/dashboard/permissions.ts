import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  READ: { code: 'system:dashboard:read', label: '仪表盘-读取', group: 'system' },
} as const);
