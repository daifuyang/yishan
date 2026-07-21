# Quickstart: Mobile User Management for Workbench

## 运行开发服务器

```bash
# 微信小程序开发
pnpm --filter yishan-app dev:weapp

# H5 开发
pnpm --filter yishan-app dev:h5
```

## 测试步骤

### 1. 进入工作台

1. 启动小程序或 H5
2. 登录管理员账号
3. 进入"应用"页面（工作台）

### 2. 展开用户列表

1. 找到"用户管理"入口（应有明显标识）
2. 点击入口
3. 验证列表展开动画（应在 300ms 内）
4. 验证显示用户列表（头像、名称、状态标签）

### 3. 测试搜索和筛选

1. 在展开列表中输入搜索关键词
2. 验证 300ms 防抖后列表更新
3. 点击状态筛选标签（全部/启用/禁用/锁定）
4. 验证列表正确过滤

### 4. 测试用户操作

1. 长按列表中某用户
2. 验证弹出操作菜单（启用/禁用、重置密码、删除）
3. 测试各操作确认流程

### 5. 测试分页

1. 上拉列表到底部
2. 验证加载更多用户
3. 加载全部后验证"没有更多了"提示

## Lint 和类型检查

```bash
pnpm --filter yishan-app lint
```

## 构建

```bash
# 微信小程序
pnpm --filter yishan-app build:weapp

# H5
pnpm --filter yishan-app build:h5
```
