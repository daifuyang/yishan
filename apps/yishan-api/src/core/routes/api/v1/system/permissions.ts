import { definePermissions } from '../../../../permissions/define-permissions.js';
export default definePermissions({
  TOKEN_LIST: { code: 'system:token:list', label: 'API Token-列表', group: 'system' },
} as const);
