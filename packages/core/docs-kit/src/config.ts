import {createRequire} from 'node:module';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {themes as prismThemes} from 'prism-react-renderer';

const require = createRequire(import.meta.url);

export interface DocsConfigOptions {
  title: string;
  tagline: string;
  siteUrl: string;
  baseUrl?: string;
  navbarTitle: string;
  docsPath: string;
  pagesPath: string;
  sidebarPath: string;
  editUrl: string;
  homepageDocId: string;
  githubUrl?: string;
  customCss?: string;
}

export function createDocsConfig(options: DocsConfigOptions): Config {
  const githubUrl = options.githubUrl ?? 'https://github.com/daifuyang/yishan';
  return {
    title: options.title,
    tagline: options.tagline,
    favicon: 'img/favicon.ico',
    future: {v4: true},
    url: options.siteUrl,
    baseUrl: options.baseUrl ?? '/',
    staticDirectories: ['public'],
    organizationName: 'zerocmf',
    projectName: 'yishan',
    onBrokenLinks: 'throw',
    markdown: {hooks: {onBrokenMarkdownLinks: 'warn'}},
    i18n: {defaultLocale: 'zh-CN', locales: ['zh-CN']},
    presets: [
      [
        'classic',
        {
          docs: {
            path: options.docsPath,
            sidebarPath: options.sidebarPath,
            editUrl: options.editUrl,
          },
          pages: {path: options.pagesPath},
          blog: false,
          theme: {
            customCss: options.customCss ?? require.resolve('@yishan/docs-kit/theme/custom.css'),
          },
        } satisfies Preset.Options,
      ],
    ],
    themeConfig: {
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: options.navbarTitle,
        logo: {alt: '移山 Logo', src: 'img/logo.svg'},
        items: [
          {type: 'docSidebar', sidebarId: 'tutorialSidebar', position: 'left', label: '文档'},
          {href: githubUrl, label: 'GitHub', position: 'right'},
        ],
      },
      footer: {
        style: 'dark',
        links: [{title: 'Docs', items: [{label: '文档', to: `/docs/${options.homepageDocId}`}]}],
        copyright: `Copyright © ${new Date().getFullYear()} 移山项目组. Built with Docusaurus.`,
      },
      prism: {theme: prismThemes.github, darkTheme: prismThemes.dracula},
    } satisfies Preset.ThemeConfig,
  };
}
