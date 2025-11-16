---
title: 目录结构
---

# 目录结构

核心结构如下：

```text
apps/yishan-admin
├─ config/
│  ├─ routes.ts            # 路由/菜单配置
│  └─ proxy.ts             # 开发代理到 API
├─ src/
│  ├─ pages/
│  │  └─ system/           # 系统管理模块页面
│  ├─ services/yishan-admin/ # OpenAPI 接口封装
│  ├─ utils/               # 认证、token 管理
│  ├─ requestErrorConfig.ts# 请求/响应拦截
│  └─ access.ts            # 路由权限控制
└─ package.json
```

系统模块页面：
- 用户管理：`src/pages/system/user`
- 角色管理：`src/pages/system/role`
- 菜单管理：`src/pages/system/menu`
- 部门管理：`src/pages/system/department`
- 岗位管理：`src/pages/system/post`