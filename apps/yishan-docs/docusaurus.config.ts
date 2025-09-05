import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "移山项目文档",
  tagline: "现代化全栈项目文档中心 - 包含管理后台、组件库、博客等",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://yishan-docs.vercel.app",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "yishan", // Usually your GitHub org/user name.
  projectName: "yishan-docs", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
          // Useful options to enforce blogging best practices
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
    navbar: {
      title: "移山平台",
      logo: {
        alt: "移山项目Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "项目概览",
        },
        {
          type: "docSidebar",
          sidebarId: "adminSidebar",
          position: "left",
          label: "管理后台",
        },
        {
          type: "docSidebar",
          sidebarId: "componentsSidebar",
          position: "left",
          label: "组件库",
        },
        { to: "/blog", label: "博客", position: "left" },
        {
          href: "https://github.com/yishan/yishan-docs",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "文档",
          items: [
            {
              label: "项目概览",
              to: "/docs/introduction",
            },
            {
              label: "管理后台",
              to: "/docs/admin",
            },
            {
              label: "组件库",
              to: "/docs/components",
            },
            {
              label: "快速开始",
              to: "/docs/introduction/quick-start",
            },
          ],
        },
        {
          title: "开发资源",
          items: [
            {
              label: "GitHub仓库",
              href: "https://github.com/yishan/yishan",
            },
            {
              label: "问题反馈",
              href: "https://github.com/yishan/yishan/issues",
            },
            {
              label: "功能建议",
              href: "https://github.com/yishan/yishan/discussions",
            },
            {
              label: "更新日志",
              href: "https://github.com/yishan/yishan/releases",
            },
          ],
        },
        {
          title: "社区",
          items: [
            {
              label: "博客",
              to: "/blog",
            },
            {
              label: "技术文档",
              to: "/docs/introduction",
            },
            {
              label: "最佳实践",
              to: "/docs/guides/best-practices",
            },
            {
              label: "联系我们",
              href: "mailto:contact@yishan.dev",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 移山快速开发平台. Built with ❤️ and Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,

  plugins: [require.resolve('./src/plugins/tailwind-plugin.ts')],
};

export default config;
