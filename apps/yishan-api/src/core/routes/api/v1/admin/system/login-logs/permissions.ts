import { definePermissions } from '../../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:login-log:list', label: '登录日志-列表', group: 'system' },
} as const);
