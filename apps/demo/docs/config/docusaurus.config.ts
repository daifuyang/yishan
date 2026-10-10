import {createDocsConfig} from '@yishan/docs-kit/config';

export default createDocsConfig({
  title: '移山 Demo',
  tagline: 'Demo 产品使用文档',
  siteUrl: process.env.DOCS_SITE_URL ?? 'https://docs.zerocmf.com',
  baseUrl: process.env.DOCS_BASE_URL ?? '/',
  navbarTitle: '移山 Demo 文档',
  docsPath: 'content',
  pagesPath: 'app/pages',
  sidebarPath: './config/sidebars.ts',
  editUrl: 'https://github.com/daifuyang/yishan/tree/main/apps/demo/docs/',
  homepageDocId: 'intro',
});
