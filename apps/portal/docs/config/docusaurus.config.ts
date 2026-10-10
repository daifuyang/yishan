import {createDocsConfig} from '@yishan/docs-kit/config';

export default createDocsConfig({
  title: '移山开发者中心',
  tagline: '平台 API、模块和扩展开发文档',
  siteUrl: process.env.DOCS_SITE_URL ?? 'http://localhost',
  baseUrl: process.env.DOCS_BASE_URL ?? '/',
  navbarTitle: '移山开发者中心',
  docsPath: 'content',
  pagesPath: 'app/pages',
  sidebarPath: './config/sidebars.ts',
  editUrl: 'https://github.com/daifuyang/yishan/tree/main/apps/portal/docs/',
  homepageDocId: 'api/overview',
});
