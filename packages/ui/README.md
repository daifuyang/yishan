# @yishan/ui

跨产品移动 UI 通过 `@yishan/ui/mobile` 导出：Button、Avatar、Badge、Tag、AppText、EmptyState、Loading、StateView、ErrorState、ListSkeleton。

样式和设计 Token 保留原实现，公开 SCSS 入口为 `@yishan/ui/mobile/tokens.scss`。这是 Taro 源码包，消费产品使用官方 compile.include 编译；React 和 Taro components 是 peers。

产品的 PermissionDenied、DashboardSkeleton、组合组件、页面和业务逻辑仍在 App。没有创建空 web 目录或复制第二套组件。

执行 `pnpm --filter @yishan/ui typecheck`。实际组件编译与浏览器行为由 `pnpm build:app`、App H5 构建及浏览器回归验证。
