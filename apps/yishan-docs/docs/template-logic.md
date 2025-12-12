# 模板逻辑说明文档

## 概述

Yishan 系统中的模板功能用于为文章和页面提供结构化的数据定义和动态表单渲染。模板系统允许管理员定义不同类型的模板，并为每种模板配置相应的字段结构，从而在创建或编辑文章/页面时动态生成表单字段。

## 核心概念

### 模板类型

系统支持两种模板类型：
1. **文章模板** (`article`) - 用于文章内容管理
2. **页面模板** (`page`) - 用于自定义页面内容管理

### 模板结构 (Schema)

模板结构是一个 JSON 数组，定义了动态表单的字段配置。每个字段包含以下属性：
- `label`: 字段显示名称
- `type`: 字段类型（如 input, textarea, radio, checkbox, select 等）
- `name`: 字段标识名称（可选）
- `required`: 是否必填（可选）
- `options`: 可选项（适用于 radio/select/checkbox 等）
- `props`: 组件属性（可选）

## 数据模型

### 数据库表结构

模板信息存储在 `portal_template` 表中，主要字段包括：
- `id`: 模板ID
- `name`: 模板名称
- `description`: 模板描述
- `type`: 模板类型（1-文章，2-页面）
- `schema`: 模板结构（JSON格式）
- `config`: 模板配置（JSON格式）
- `status`: 状态（0-禁用，1-启用）
- `isSystemDefault`: 是否系统默认模板

### 关联关系

- 文章表 (`portal_article`) 通过 `template_id` 字段关联到模板表
- 页面表 (`portal_page`) 通过 `template_id` 字段关联到模板表

## API 接口

### 模板管理接口

1. **获取模板列表**
   - 文章模板: `GET /api/v1/admin/articles/templates`
   - 页面模板: `GET /api/v1/admin/pages/templates`

2. **创建模板**
   - 文章模板: `POST /api/v1/admin/articles/templates`
   - 页面模板: `POST /api/v1/admin/pages/templates`

3. **获取模板详情**
   - 文章模板: `GET /api/v1/admin/articles/templates/{id}`
   - 页面模板: `GET /api/v1/admin/pages/templates/{id}`

4. **更新模板**
   - 文章模板: `PUT /api/v1/admin/articles/templates/{id}`
   - 页面模板: `PUT /api/v1/admin/pages/templates/{id}`

5. **删除模板**
   - 文章模板: `DELETE /api/v1/admin/articles/templates/{id}`
   - 页面模板: `DELETE /api/v1/admin/pages/templates/{id}`

### 模板结构管理接口

1. **获取模板结构**
   - 文章模板: `GET /api/v1/admin/articles/templates/{id}/schema`
   - 页面模板: `GET /api/v1/admin/pages/templates/{id}/schema`

2. **更新模板结构**
   - 文章模板: `PUT /api/v1/admin/articles/templates/{id}/schema`
   - 页面模板: `PUT /api/v1/admin/pages/templates/{id}/schema`

### 文章/页面模板关联接口

1. **设置文章模板**
   - `PATCH /api/v1/admin/articles/{id}/template`

2. **设置页面模板**
   - `PATCH /api/v1/admin/pages/{id}/template`

## 前端实现

### 模板管理页面

1. **模板列表页**
   - 显示文章模板和页面模板列表
   - 提供创建、编辑、删除模板功能
   - 提供配置模板结构功能

2. **模板表单组件**
   - 用于创建和编辑模板基本信息
   - 包含模板名称、描述、状态等字段

3. **模板结构配置组件**
   - 通过抽屉形式展示模板字段配置
   - 提供字段的增删改查功能
   - 支持多种字段类型配置

### 动态表单渲染

1. **TemplateDynamicFields 组件**
   - 根据模板结构动态渲染表单字段
   - 支持 input、textarea、radio、checkbox、select 等字段类型
   - 自动处理字段的必填验证

2. **文章/页面表单集成**
   - 在文章和页面表单中集成模板结构渲染
   - 当选择了模板后，自动加载并显示对应的动态字段
   - 提交时将动态字段的值聚合到 attributes 字段中

## 业务逻辑

### 默认模板机制

系统支持设置默认模板：
1. 当文章或页面未绑定特定模板时，系统会使用默认模板
2. 默认模板通过 `isSystemDefault` 字段标识
3. 系统会自动为文章和页面分配相应的默认模板

### 模板字段数据存储

1. 模板结构存储在 `portal_template` 表的 `schema` 字段中
2. 文章/页面的实际字段值存储在各自的 `attributes` 字段中（JSON格式）
3. 前端通过动态表单将字段值聚合到 attributes 中进行提交

## 使用流程

### 创建和配置模板

1. 进入模板管理页面（文章模板或页面模板）
2. 点击"新建"按钮创建模板
3. 填写模板基本信息（名称、描述、状态等）
4. 保存模板后，点击"配置结构"按钮
5. 在结构配置界面添加所需字段
6. 保存模板结构配置

### 使用模板创建内容

1. 进入文章或页面管理页面
2. 点击"新建"按钮创建内容
3. 在表单中选择相应的模板
4. 表单会自动加载模板定义的字段
5. 填写所有字段信息后提交表单

## 注意事项

1. 系统默认模板不可删除
2. 模板结构的修改不会影响已有的文章或页面数据
3. 动态字段的值存储在 attributes 字段中，以键值对形式保存
4. 模板字段的 name 属性用于标识字段，应保持唯一性