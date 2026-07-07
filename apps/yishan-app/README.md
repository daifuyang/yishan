# 移山小程序 (yishan-app)

Taro 4 + React 18 微信小程序 + H5，**yishan 中后台的移动端基座**（与 admin 共享 system 域能力）。

## 业务定位

| 维度 | 决策 |
|---|---|
| 角色 | yishan 中后台的**移动端基座**（admin mobile client base） |
| 数据源 | yishan-api **core 域 app 通道**（`/api/v1/app/...`） |
| 业务扩展 | 后续通过 plugin 机制按需挂载（shop 商品/订单、portal 文章/页面） |
| 设计 | 钉钉/飞书 ToB（钉钉蓝 `#1677FF` + 克制圆角） |
| 端 | 微信小程序 + H5（首版 H5 走账号密码登录） |

## Tab

1. **首页** — 问候 + 最近登录 3 条 + 跳应用
2. **应用** — 对齐 admin `system` 菜单，按已授权菜单树动态渲染
3. **我的** — 个人资料 + 改密 + 登录日志 + 通讯录 + 退出

## 快速开始

```bash
# 启动 yishan-api（默认端口 3000）
pnpm --filter yishan-api dev

# H5 开发
pnpm --filter yishan-app dev:h5
# 访问 http://localhost:21003

# 微信小程序开发（需要微信开发者工具打开 dist/ 预览）
pnpm --filter yishan-app dev:weapp

# 构建
pnpm --filter yishan-app build:weapp
pnpm --filter yishan-app build:h5

# Lint + 类型检查
pnpm --filter yishan-app lint
```

默认账号：`admin / admin123`

## 项目结构

```
src/
├── api/                       # API 客户端 + 业务模块
│   ├── client.ts              # Taro.request + 401 拦截
│   ├── auth.ts                # 登录/退出/refresh/me
│   ├── user.ts                # me / password / login-logs
│   ├── menu.ts                # authorized / flatten
│   ├── contacts.ts            # 部门树 / 部门成员
│   ├── dict.ts                # 按 type 查询
│   ├── types.ts               # 通用类型 / ApiError
│   └── index.ts
├── stores/                    # 全局状态（zustand）
│   └── auth.ts                # token + currentUser + bootstrap
├── utils/
│   ├── storage.ts             # Taro 存储封装
│   ├── router.ts              # 401 → login
│   ├── auth-guard.ts          # useRequireAuth hook
│   └── format.ts              # 日期/首字
├── constants/
│   ├── routes.ts              # 路径常量
│   └── index.ts               # TAB_BAR / THEME
├── components/
│   ├── atoms/                 # Button / Text / Avatar / Tag / Badge
│   ├── molecules/             # Card / ListItem / SearchBar / GridItem / SectionHeader
│   ├── organisms/             # HomeHeader / WorkbenchGrid / MineProfile / TabBar
│   ├── feedback/              # EmptyState / Loading
│   └── icons/
├── pages/
│   ├── index/                 # 首页
│   ├── apps/                  # 应用
│   ├── mine/                  # 我的
│   ├── login/                 # 登录
│   ├── profile/
│   │   ├── edit/              # 改资料
│   │   ├── password/          # 改密
│   │   └── login-log/         # 登录日志列表
│   └── contacts/
│       ├── index/             # 部门树
│       └── dept/              # 部门成员
├── app.config.ts              # pages / window
├── app.ts                     # 入口 + 启动拦截
├── app.scss
└── config.ts                  # API_BASE_URL
```

## API 通道

`yishan-api` core 端 app 通道（`apps/yishan-api/src/core/routes/api/v1/app/`）：

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/v1/app` | GET | 根 |
| `/api/v1/app/auth/login` | POST | 账号密码登录 |
| `/api/v1/app/auth/logout` | POST | 退出 |
| `/api/v1/app/auth/refresh` | POST | 刷新令牌 |
| `/api/v1/app/auth/me` | GET | 当前用户（含 accessPath） |
| `/api/v1/app/menus/authorized` | GET | 已授权菜单（树） |
| `/api/v1/app/menus/flatten` | GET | 已授权菜单（扁平） |
| `/api/v1/app/contacts/depts/tree` | GET | 部门树 |
| `/api/v1/app/contacts/depts/:id/users` | GET | 部门成员 |
| `/api/v1/app/dicts` | GET | 字典映射 |
| `/api/v1/app/dicts/:type` | GET | 按 type 查询字典 |
| `/api/v1/app/users/me` | PUT | 改资料 |
| `/api/v1/app/users/me/password` | PUT | 改密（强制重登） |
| `/api/v1/app/users/me/login-logs` | GET | 我的登录日志 |

**复用 core service**（`AuthService` / `UserService` / `MenuService` / `DeptService` / `DictService` / `LoginLogModel`），不强制 RBAC perm。

## 设计语言

钉钉/飞书 ToB 风格：
- 主色：`#1677FF`（钉钉蓝）
- 圆角克制：2/4/6/8/12px
- 阴影克制：2 级
- 间距 8 网格；字号 12-32
- 按压反馈：`opacity: 0.6`

完整 Token 在 `src/styles/tokens.scss`，不要在业务代码里硬编码色值/间距/字号。

## 后续工作

- [ ] 微信小程序登录（`Taro.login` + `jscode2session`）
- [ ] 通知中心（plugin）
- [ ] 头像上传
- [ ] 应用点击 → 实际业务页（plugin 化扩展）
- [ ] 替换占位 TabBar 图标为矢量导出的高质量 PNG
- [ ] 单元测试 / Storybook
- [ ] shop / portal 业务入口（plugin 化按需挂载）
