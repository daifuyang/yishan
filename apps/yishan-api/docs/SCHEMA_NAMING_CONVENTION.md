# Schema 命名规范文档

## 概述
本文档定义了 Yishan API 项目中 JSON Schema 的命名规范，确保代码的一致性和可维护性。

## 命名原则

### 1. 数据库表关联原则
- **必须**与数据库表名保持一致
- 使用数据库表的完整名称（包括前缀）
- 示例：`sys_user` 表 → `sysUserSchema`

### 2. 业务模块关联原则
- **必须**包含业务模块前缀
- 使用小驼峰命名法（camelCase）
- 示例：系统用户模块 → `sysUser...`

### 3. 功能类型后缀原则
- **必须**添加功能类型后缀
- 支持的类型：
  - `Schema` - 数据模型
  - `RequestSchema` - 请求参数
  - `ResponseSchema` - 响应数据
  - `Request` - 简化请求
  - `Response` - 简化响应

## 命名格式

### 完整格式
```
[业务前缀][功能名称][类型后缀]
```

### 具体规则
1. **业务前缀**：对应数据库表的前缀或业务模块
   - `sys` - 系统管理相关
   - `biz` - 业务相关
   - `auth` - 认证授权相关

2. **功能名称**：对应数据库表的核心名称
   - 使用单数形式
   - 首字母大写

3. **类型后缀**：根据用途选择
   - `Schema` - 完整数据模型
   - `RequestSchema` - 请求参数验证
   - `ResponseSchema` - 响应数据结构

## 示例规范

### 当前实现示例
```typescript
// ✅ 正确示例
export const sysUserSchema = {
  $id: 'sysUser',  // 对应 sys_user 表
  type: 'object',
  properties: {
    // ... 用户属性
  }
}

export const sysUserTokenResponseSchema = {
  $id: 'sysUserTokenResponse',  // 系统用户token响应
  type: 'object',
  properties: {
    // ... token相关属性
  }
}

export const sysUserLoginRequestSchema = {
  $id: 'sysUserLoginRequest',  // 系统用户登录请求
  type: 'object',
  properties: {
    // ... 登录参数
  }
}
```

### 反例（❌ 已废弃）
```typescript
// ❌ 错误示例（已修正）
export const userSchema = {  // 缺少业务前缀
  $id: 'user',  // 太简单，无法体现业务含义
  type: 'object',
  properties: {
    // ...
  }
}

export const tokenResponseSchema = {  // 缺少业务前缀
  $id: 'tokenResponse',
  type: 'object',
  properties: {
    // ...
  }
}
```

## 文件组织规范

### 文件命名
- 使用 `kebab-case` 命名法
- 格式：`[模块名].schema.ts`
- 示例：`auth.schema.ts`、`user.schema.ts`

### 导出规范
- 所有schema **必须**使用具名导出
- 导出名称必须与 `$id` 保持一致（首字母大写）

### 目录结构
```
src/
├── schemas/                    # Schema定义目录
│   ├── auth.schema.ts        # 认证相关schema
│   ├── user.schema.ts        # 用户相关schema
│   └── [模块].schema.ts      # 其他业务模块
├── routes/                    # 路由定义
│   └── api/v1/
│       └── [模块].ts          # 路由文件
└── plugins/external/          # 插件目录
    └── schemas.ts            # 全局schema注册（集中管理）
```

### 命名规范
- Schema文件使用kebab-case命名：`auth.schema.ts`
- 导出对象使用camelCase命名：`sysUserSchema`
- 避免在路由文件中重复注册schema

### 最佳实践
1. **集中注册**：所有schema统一在`plugins/external/schemas.ts`中注册
2. **职责分离**：路由文件专注业务逻辑，schema管理由插件负责
3. **路径规范**：使用正确的相对路径（如`../../schemas/auth.schema.js`）
4. **插件包装**：使用`fastify-plugin`包装插件，确保正确元数据

### 新增模块步骤
1. 在`schemas/`目录创建新的schema文件
2. 在`plugins/external/schemas.ts`中导入并注册新schema
3. 在路由文件中直接使用$ref引用，无需重复注册

## 更新记录

| 日期 | 版本 | 变更内容 | 影响范围 |
|------|------|----------|----------|
| 2024-12-19 | v1.0 | 建立规范文档 | 所有schema文件 |
| 2024-12-19 | v1.1 | 修正auth.schema.ts命名 | 认证相关schema |
| 2024-12-19 | v1.2 | 更新目录结构和最佳实践 | 所有schema文件及目录结构 |

## 实施检查清单

- [x] 所有schema命名符合规范
- [x] 所有$id值与导出名称匹配
- [x] 所有路由文件引用已更新
- [x] 文档已同步更新
- [ ] 代码审查流程建立
- [ ] 自动化检查工具集成

## 相关文档
- [SCHEMA_REFACTORING.md](../SCHEMA_REFACTORING.md) - Schema重构说明
- [PROJECT_SPECIFICATION.md](./PROJECT_SPECIFICATION.md) - 项目规范总览