import { definePermissions } from '../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:attachment:list', label: '附件管理-列表', group: 'system' },
  CREATE: { code: 'system:attachment:create', label: '附件管理-创建', group: 'system' },
  UPDATE: { code: 'system:attachment:update', label: '附件管理-更新', group: 'system' },
  DELETE: { code: 'system:attachment:delete', label: '附件管理-删除', group: 'system' },
} as const);
