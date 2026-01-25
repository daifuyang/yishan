# app.prisma 模型关系与作用说明

本文梳理 `apps/yishan-api/prisma/schema/app.prisma` 中与“应用、资源、表单、菜单”相关的模型，说明每个模型承担的职责、关键字段含义、以及模型之间的关系与数据流动方式，便于理解整体设计。

## 总体概览

这一组模型围绕“应用（SysApp）→ 资源（SysAppResource）→ 表单字段/表单数据（SysFormField / SysFormData）”的主链路展开，并通过“应用菜单（SysAppMenu）”把资源映射到导航结构中。

- SysApp：应用主体
- SysAppResource：应用内的资源入口（表单、报表、看板、外链等）
- SysFormField：表单字段定义（依附于某个资源）
- SysFormData：表单数据记录（依附于某个资源）
- SysAppMenu：应用菜单结构（可绑定资源）

## 模型说明与关系

### 1. SysApp（应用）

**作用**  
系统中的应用实体，承载应用的基本信息与生命周期（状态、排序、软删除等）。

**关键字段**  
- `name`：应用名称（唯一）
- `status`：应用状态
- `sort_order`：排序权重
- `deletedAt`：软删除标记
- `creatorId / updaterId`：审计字段

**关系**  
- 一对多 `menus` → SysAppMenu  
- 一对多 `resources` → SysAppResource  
- 与 SysUser 通过 `creator` / `updater` 关系关联

### 2. SysAppResource（应用资源）

**作用**  
应用内的“功能入口/资源”抽象。它是表单、报表、看板、外链等多种资源类型的统一载体。

**关键字段**  
- `appId`：所属应用
- `type`：资源类型（如 FORM、REPORT、DASHBOARD、EXTERNAL_LINK）
- `name`：资源名称
- `config`：资源配置（JSON）
- `status / sort_order / deletedAt`：状态、排序与软删除

**关系**  
- 多对一 `app` → SysApp  
- 一对多 `formFields` → SysFormField  
- 一对多 `formDatas` → SysFormData  
- 一对多 `menus` → SysAppMenu  
- 与 SysUser 通过 `creator` / `updater` 关系关联

**设计要点**  
SysAppResource 把“表单定义”抽象成资源之一，因此表单本身不是独立表，而是资源类型的一种。这样可以把菜单、权限、展示等能力统一地挂在“资源”层。

### 3. SysFormField（表单字段）

**作用**  
描述某个表单资源的字段定义（字段 key、类型、是否必填、配置等）。

**关键字段**  
- `resourceId`：所属资源（即表单）
- `key`：字段唯一标识
- `type`：字段类型（text、select、date 等）
- `required`：是否必填
- `config`：字段配置（JSON）
- `status / sort_order / deletedAt`：状态、排序与软删除

**关系**  
- 多对一 `resource` → SysAppResource  
- 与 SysUser 通过 `creator` / `updater` 关系关联

**约束**  
- `@@unique([resourceId, key])`：同一表单内字段 key 唯一

### 4. SysFormData（表单数据）

**作用**  
存储表单提交的数据记录，与字段定义解耦，使用 JSON 结构持久化。

**关键字段**  
- `resourceId`：所属资源（即表单）
- `data`：表单数据（JSON）
- `status / createdAt / deletedAt`：状态与生命周期

**关系**  
- 多对一 `resource` → SysAppResource  
- 与 SysUser 通过 `creator` / `updater` 关系关联

**设计要点**  
使用 `Json` 类型存储数据，便于不同表单结构动态扩展；字段定义与数据记录通过 `resourceId` 关联。

### 5. SysAppMenu（应用菜单）

**作用**  
应用内菜单与导航结构，支持树形层级，可绑定资源或纯路由。

**关键字段**  
- `appId`：所属应用
- `parentId`：父级菜单（树结构）
- `path / component`：前端路由与组件
- `type`：菜单类型（目录/菜单/按钮）
- `resourceId`：可选绑定资源
- `hideInMenu / isExternalLink / keepAlive`：展示行为

**关系**  
- 多对一 `app` → SysApp  
- 多对一 `resource` → SysAppResource（可为空）  
- 自引用 `parent / children` → SysAppMenu  
- 与 SysUser 通过 `creator` / `updater` 关系关联

**约束**  
- `@@unique([appId, parentId, name])`：同应用同父级下菜单名唯一

## 关键关系图（文字版）

- SysApp  
  - 1 → N SysAppResource  
  - 1 → N SysAppMenu  
- SysAppResource  
  - 1 → N SysFormField  
  - 1 → N SysFormData  
  - 1 → N SysAppMenu（资源可被多个菜单引用）
- SysAppMenu  
  - 自引用父子结构

## 典型业务流

1. 创建应用（SysApp）
2. 在应用下创建资源（SysAppResource），类型为 FORM
3. 为该资源定义字段（SysFormField）
4. 用户提交表单数据（SysFormData）
5. 菜单挂载该资源（SysAppMenu.resourceId），实现导航入口

## 仓储管理示例（覆盖所有资源类型）

### 1. 应用层（SysApp）

- 应用：仓储管理系统

### 2. 资源层（SysAppResource）

在同一个应用下创建多个资源，覆盖所有资源类型：

- FORM：入库单
- PROCESS_FORM：出库审核流程表单
- REPORT：库存周报
- PORTAL_BROADCAST：仓库公告
- DASHBOARD：库存看板
- CUSTOM_PAGE：仓库平面图
- EXTERNAL_LINK：物流系统链接

### 3. 表单字段（SysFormField）

对 FORM 类型资源“入库单”定义字段：

- 入库单号（key: inCode）
- 供应商（key: supplier）
- 入库日期（key: inDate）
- 物料明细（key: items）

对 PROCESS_FORM 类型资源“出库审核流程表单”定义字段：

- 出库单号（key: outCode）
- 审核人（key: approver）
- 审核结果（key: decision）

### 4. 表单数据（SysFormData）

实际业务录入的记录示例：

- 入库单数据：{ inCode: "RK20250125-001", supplier: "A供应商", inDate: "2025-01-25", items: [...] }
- 出库审核数据：{ outCode: "CK20250125-003", approver: "张三", decision: "通过" }

### 5. 菜单层（SysAppMenu）

菜单映射到资源与页面：

- 菜单“入库管理” → 绑定资源“入库单”
- 菜单“出库审核” → 绑定资源“出库审核流程表单”
- 菜单“库存周报” → 绑定资源“库存周报”
- 菜单“库存看板” → 绑定资源“库存看板”
- 菜单“仓库公告” → 绑定资源“仓库公告”
- 菜单“仓库平面图” → 绑定资源“仓库平面图”
- 菜单“物流系统” → 外链资源“物流系统链接”

## 文件定位

- [app.prisma](file:///c:/Workspace/Frontend/yishan/apps/yishan-api/prisma/schema/app.prisma)
