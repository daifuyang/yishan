# 新模块开发规范指南

本文档以角色管理模块为例，提供了在 Yishan Admin 系统中创建新模块的标准规范和最佳实践。

## 目录

1. [模块结构和目录规范](#模块结构和目录规范)
2. [组件开发规范](#组件开发规范)
3. [API 集成规范](#api-集成规范)
4. [路由和菜单配置规范](#路由和菜单配置规范)
5. [国际化配置规范](#国际化配置规范)

## 模块结构和目录规范

### 目录结构

新模块应遵循以下目录结构：

```
src/pages/[模块分类]/[模块名称]/
├── index.tsx                 # 模块主页面
├── components/               # 模块特有组件
│   ├── [ComponentName].tsx   # 组件文件
│   └── ...
├── services/                 # 模块特有服务（如果需要）
│   └── ...
└── utils/                    # 模块特有工具函数（如果需要）
    └── ...
```

以角色管理模块为例：

```
src/pages/system/role/
├── index.tsx                 # 角色列表页面
├── components/               # 角色管理相关组件
│   ├── RoleForm.tsx          # 角色表单组件
│   └── ...
```

### 命名规范

- **目录名**：使用小写字母，多个单词用连字符（-）连接
- **文件名**：
  - 组件文件使用 PascalCase（如 `RoleForm.tsx`）
  - 非组件文件使用 camelCase（如 `roleService.ts`）
- **组件名**：使用 PascalCase（如 `RoleList`、`RoleForm`）
- **变量和函数名**：使用 camelCase（如 `handleSubmit`、`roleData`）

## 组件开发规范

### 组件结构

组件应遵循以下结构：

```tsx
import React from 'react';
import { 相关组件库导入 } from 'antd';
import { 相关服务导入 } from '@/services/...';

/**
 * 组件类型定义
 */
interface ComponentProps {
  // 属性定义
}

/**
 * 组件描述注释
 */
const ComponentName: React.FC<ComponentProps> = (props) => {
  // 状态定义
  
  /**
   * 函数描述注释
   */
  const handleSomeAction = () => {
    // 实现
  };
  
  return (
    // JSX 结构
  );
};

export default ComponentName;
```

### 最佳实践

1. **状态管理**：
   - 使用 React Hooks 管理组件状态
   - 将相关状态和处理函数放在一起
   - 对于复杂状态，考虑使用 useReducer

2. **组件拆分**：
   - 将大型组件拆分为小型、可复用的组件
   - 将表单、列表等功能拆分为独立组件

3. **性能优化**：
   - 使用 React.memo 避免不必要的重渲染
   - 使用 useCallback 和 useMemo 优化性能

### 角色管理模块示例

```tsx
// 列表页面示例
import { PlusOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Form, message, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { getRoleList, updateRole } from '@/services/yishan-admin/sysRoles';
import RoleForm from './components/RoleForm';

/**
 * 角色管理列表页面
 */
const RoleList: React.FC = () => {
  // 状态和引用定义
  const actionRef = useRef<ActionType>(null);
  const [form] = Form.useForm();
  const [formVisible, setFormVisible] = useState(false);
  
  // 处理函数
  const handleStatusChange = async (id: number, status: number) => {
    // 实现
  };
  
  // 渲染
  return (
    <>
      <ProTable<API.sysRole>
        // 表格配置
      />
      <RoleForm
        // 表单组件属性
      />
    </>
  );
};

export default RoleList;
```

## API 集成规范

### API 服务文件

API 服务应放在 `src/services/yishan-admin/` 目录下，按功能模块分类：

```ts
// src/services/yishan-admin/sysRoles.ts

import { request } from "@umijs/max";

/** 获取角色列表 GET /api/v1/admin/roles/ */
export async function getRoleList(
  params: API.getRoleListParams,
  options?: { [key: string]: any }
) {
  return request<API.ApiResponse<API.sysRoleListResponse>>("/api/v1/admin/roles/", {
    method: "GET",
    params: {
      // 默认参数
      page: "1",
      pageSize: "10",
      ...params,
    },
    ...(options || {}),
  });
}

// 其他 API 函数
```

### 最佳实践

1. **请求函数命名**：
   - 使用动词开头，如 `getXXX`、`createXXX`、`updateXXX`、`deleteXXX`
   - 名称应清晰表达功能

2. **参数类型**：
   - 为所有参数定义明确的类型
   - 使用 TypeScript 接口定义请求和响应类型

3. **错误处理**：
   - 在组件中统一处理 API 错误
   - 使用 try/catch 捕获异常

4. **注释**：
   - 为每个 API 函数添加注释，说明其功能、参数和返回值
   - 注明 API 端点路径

## 路由和菜单配置规范

### 路由配置

在 `config/routes.ts` 文件中添加新模块的路由配置：

```ts
// 系统管理模块路由
{
  path: '/system',
  name: 'system',
  icon: 'setting',
  routes: [
    {
      path: '/system',
      redirect: '/system/user',
    },
    {
      path: '/system/user',
      name: 'user',
      component: './system/user',
    },
    {
      path: '/system/role',
      name: 'role',
      component: './system/role',
    },
    // 添加新模块路由
  ],
}
```

### 菜单配置

路由配置中的 `name` 属性会自动映射到菜单项，需要在国际化文件中添加对应的翻译。

### 最佳实践

1. **路由命名**：
   - 使用有意义的路径名，通常是模块的英文名称
   - 保持路径结构清晰，反映模块的层级关系

2. **组件路径**：
   - 使用相对路径，从 `src/pages` 开始
   - 确保路径与实际文件位置一致

3. **权限控制**：
   - 如需权限控制，添加 `access` 属性
   - 在 `src/access.ts` 中定义对应的权限检查函数

## 国际化配置规范

### 菜单国际化

在 `src/locales/zh-CN/menu.ts` 和其他语言文件中添加菜单项的翻译：

```ts
// src/locales/zh-CN/menu.ts
export default {
  // 其他菜单项
  'menu.system': '系统管理',
  'menu.system.user': '用户管理',
  'menu.system.role': '角色管理',
  // 添加新模块的菜单翻译
};
```

### 页面内容国际化

对于页面内容的国际化，使用 `useIntl` hook：

```tsx
import { useIntl } from '@umijs/max';

const RoleList: React.FC = () => {
  const intl = useIntl();
  
  const columns = [
    {
      title: intl.formatMessage({ id: 'pages.role.columns.name', defaultMessage: '角色名称' }),
      // ...
    },
    // 其他列
  ];
  
  return (
    // ...
  );
};
```

在 `src/locales/zh-CN/pages.ts` 中添加对应的翻译：

```ts
// src/locales/zh-CN/pages.ts
export default {
  // 其他翻译
  'pages.role.columns.name': '角色名称',
  'pages.role.columns.code': '角色编码',
  // 添加新模块的页面内容翻译
};
```

### 最佳实践

1. **键名规范**：
   - 菜单项使用 `menu.{模块}.{子模块}` 格式
   - 页面内容使用 `pages.{模块}.{类别}.{元素}` 格式

2. **默认消息**：
   - 始终提供 `defaultMessage` 作为备用
   - 确保默认消息与翻译内容一致

3. **完整覆盖**：
   - 确保所有支持的语言都有对应的翻译
   - 检查翻译是否完整，避免遗漏

---

遵循以上规范，可以确保新模块的开发符合项目标准，提高代码质量和可维护性。以角色管理模块为例，我们展示了如何正确地组织代码结构、实现功能和配置路由菜单，为后续模块开发提供了参考模板。