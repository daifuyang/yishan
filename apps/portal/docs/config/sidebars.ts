import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'api/overview',
    {
      type: 'category',
      label: 'API 与平台',
      collapsed: false,
      items: [
        'api/stack', 'api/structure', 'api/auth', 'api/plugins', 'api/config',
        'api/error-handling', 'api/business-codes', 'api/schemas', 'api/routes',
        'api/database', 'api/cache', 'api/system-tasks',
      ],
    },
    {
      type: 'category',
      label: '前端接入',
      items: ['frontend/overview', 'frontend/stack', 'frontend/structure', 'frontend/routing', 'frontend/menu-loading', 'frontend/auth', 'frontend/request', 'frontend/openapi', 'frontend/i18n', 'frontend/pwa'],
    },
    {
      type: 'category',
      label: '模块与插件开发',
      items: ['architecture/overview', 'architecture/plugin-runtime', 'modules/onboarding', 'modules/plugin-module-template', 'template-logic'],
    },
    {
      type: 'category',
      label: '部署运维',
      items: ['deploy/dev', 'deploy/prod'],
    },
  ],
};

export default sidebars;
