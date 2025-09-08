import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  // 指南文档侧边栏
  guideSidebar: [
    {
      type: 'category',
      label: '开发指南',
      items: [
        'guide/index',
        'guide/quick-start',
        'guide/project-structure',
        'guide/best-practices'
      ]
    }
  ],
  
  // 组件库侧边栏
  componentsSidebar: [
    {
      type: 'category',
      label: '组件库文档',
      items: [
        'components/index',
        'components/button',
        'components/input',
        'components/card'
      ]
    }
  ],
  
  // 管理后台侧边栏
  adminSidebar: [
    {
      type: 'category',
      label: '管理后台文档',
      items: [
        'admin/index'
      ]
    }
  ]
};

export default sidebars;
