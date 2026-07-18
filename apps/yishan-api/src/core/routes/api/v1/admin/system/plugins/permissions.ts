import { definePermissions } from '../../../../../../permissions/define-permissions.js';
export default definePermissions({
  LIST: { code: 'system:plugin:list', label: '插件管理-列表', group: 'system' },
  ENABLE: { code: 'system:plugin:enable', label: '插件管理-启用', group: 'system' },
  DISABLE: { code: 'system:plugin:disable', label: '插件管理-禁用', group: 'system' },
  SYNC: { code: 'system:plugin:sync', label: '插件管理-同步', group: 'system' },
  AUDIT: { code: 'system:plugin:audit', label: '插件管理-审计', group: 'system' },
} as const);
