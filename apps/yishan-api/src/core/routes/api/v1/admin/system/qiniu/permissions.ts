import { definePermissions } from '../../../../../../permissions/define-permissions.js';
export default definePermissions({
  UPLOAD_TOKEN: { code: 'system:storage:upload-token', label: '存储管理-上传令牌', group: 'system' },
} as const);
