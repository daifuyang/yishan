# 移山快速开发平台文档

这是移山快速开发平台的官方文档站点，使用Docusaurus构建，提供完整的项目文档、教程和API参考。

## 🎯 关于移山平台

移山快速开发平台是基于Next.js 15 + TypeScript + Tailwind CSS的现代化全栈开发平台，包含：
- 🎨 **管理后台** - 企业级管理界面
- 🧩 **组件库** - 基于shadcn/ui的组件集合  
- 📚 **完整文档** - 全面的开发指南

## 🚀 快速开始

### 环境要求
- Node.js 18+
- pnpm 8+

### 安装和运行

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm start

# 构建生产版本
pnpm build

# 本地预览构建结果
pnpm serve
```

### 访问地址
- **开发环境**: http://localhost:3001
- **生产环境**: https://yishan-docs.vercel.app

## 📁 文档结构

```
docs/
├── introduction/     # 项目概览和快速开始
│   ├── index.md      # 欢迎页面
│   └── overview.md   # 项目概览
├── admin/           # 管理后台文档
│   └── index.md     # 管理后台主页
├── components/      # 组件库文档
│   └── index.md     # 组件库主页
└── blog/          # 技术博客
```

## 🛠️ 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm start` | 启动开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm serve` | 本地预览构建结果 |
| `pnpm clear` | 清理缓存 |
| `pnpm deploy` | 部署到GitHub Pages |

## 🧪 技术栈

- **框架**: Docusaurus 3.x
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **部署**: Vercel
- **域名**: yishan-docs.vercel.app

## 🤝 参与贡献

我们欢迎所有形式的贡献！

### 贡献方式
- 🐛 **报告Bug**: 提交Issue
- 💡 **功能建议**: 参与讨论  
- 📖 **改进文档**: 提交PR
- 🎨 **UI优化**: 设计改进

### 贡献流程
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 发起Pull Request

## 📞 联系我们

- **文档问题**: [GitHub Issues](https://github.com/yishan/yishan-docs/issues)
- **技术支持**: [GitHub Discussions](https://github.com/yishan/yishan/discussions)
- **邮件联系**: contact@yishan.dev

---

**让开发更简单，让创意更自由！** ✨
