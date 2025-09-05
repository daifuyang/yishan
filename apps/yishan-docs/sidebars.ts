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
  // 项目概览侧边栏
  tutorialSidebar: [
    'introduction/index',
    'introduction/overview',
  ],

  // 管理后台侧边栏
  adminSidebar: [
    'admin/index',
  ],

  // 组件库侧边栏
  componentsSidebar: [
    'components/index',
  ],
};

export default sidebars;
