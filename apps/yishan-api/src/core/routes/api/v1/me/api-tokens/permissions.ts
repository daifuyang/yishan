import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  MANAGE: { code: 'system:api-token:manage', label: 'API Token-管理', group: 'system' },
} as const);
