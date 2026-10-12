import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: '快速开始',
      collapsed: false,
      items: ['quick-start/environment', 'quick-start/run', 'quick-start/build', 'quick-start/workspace'],
    },
    {
      type: 'category',
      label: 'Demo 功能模块',
      items: ['modules/users', 'modules/roles', 'modules/menus', 'modules/departments', 'modules/posts', 'modules/system'],
    },
    'faq',
  ],
};

export default sidebars;
