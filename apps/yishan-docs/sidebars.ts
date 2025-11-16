import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: '快速开始',
      collapsed: false,
      items: [
        'quick-start/environment',
        'quick-start/run',
        'quick-start/build',
        'quick-start/workspace',
      ],
    },
    {
      type: 'category',
      label: '前端（yishan-admin）',
      items: [
        'frontend/overview',
        'frontend/stack',
        'frontend/structure',
        'frontend/routing',
        'frontend/menu-loading',
        'frontend/auth',
        'frontend/request',
        'frontend/list-spec',
        'frontend/openapi',
        'frontend/i18n',
        'frontend/pwa',
      ],
    },
    {
      type: 'category',
      label: '后端（yishan-api）',
      items: [
        'api/overview',
        'api/stack',
        'api/structure',
        'api/auth',
        'api/plugins',
        'api/config',
        'api/error-handling',
        'api/business-codes',
        'api/schemas',
        'api/routes',
        'api/database',
        'api/cache',
        'api/system-tasks',
      ],
    },
    {
      type: 'category',
      label: '系统模块',
      items: [
        'modules/users',
        'modules/roles',
        'modules/menus',
        'modules/departments',
        'modules/posts',
        'modules/system',
      ],
    },
    {
      type: 'category',
      label: '部署运维',
      items: ['deploy/dev', 'deploy/prod'],
    },
  ],
};

export default sidebars;
