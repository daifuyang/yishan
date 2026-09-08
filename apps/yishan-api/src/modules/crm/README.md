# CRM 模块

> Yishan（移山通用管理系统）的客户关系管理业务插件。
> 一份"自包含"的最小完整 CRM：客户、联系人、跟进记录、公海、认领 / 释放 / 转交、字典设置、工作台。

模块标识：`meta.id = 'crm'`；路由前缀 `/api/crm`；表前缀 `crm_`。
按 Yishan 模块规范落地：菜单由 `config/system-menu.json` 自描述，权限码由 `routes/v1/**/index.ts` 集中声明。

---

## 1. 产品定位

CRM 是 Yishan 的"标杆业务模块"：覆盖一个最小可用销售系统所需的核心实体与流转，把"客户流转 + 数据范围 + 字典管理 + 工作台"四件事做成可复用的样板，供后续 `portal` / `shop` 等业务模块参考。

### 1.1 目标场景

- 销售（`sales`）登录后看工作台 → 处理"我的客户 / 待跟进 / 公海"，写跟进、做客户流转。
- 销售主管（`sales_lead`）能看本部门所有客户，跨同事协助。
- 管理员（`super_admin`）维护字典（客户状态 / 来源 / 标签），并能对任意客户进行强制认领 / 转交。

### 1.2 MVP 范围

**包含：**

- 客户 CRUD + 查重（企业 / 个人两套规则）。
- 联系人 CRUD（隶属于客户）。
- 跟进记录（活动）：写跟进同步刷新客户"最近跟进 / 下次跟进"时间。
- 客户流转：公海 ← 释放，公海 → 认领，销售之间 → 转交。
- 工作台：6 个核心计数器 + 待跟进客户 + 最近动态。
- 字典管理：客户标签、客户状态（系统内置 6 档）、客户来源（系统预置 9 个）。

**不包含（留给后续版本）：**

- 商机（Opportunity）/ 合同 / 订单 / 报价 / 发票。
- 复杂审批、工作流引擎、营销自动化。
- 自定义字段平台、页面设计器、状态机 DSL。
- 客户合并 / 拆分，以及客户等其他业务对象的批量导入导出。

---

## 2. 核心业务流程

一张图走完"销售日常"：

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CRM 业务主循环                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                ▲
                                │
       ┌──────── 写跟进 ────────┴─────── 写跟进 ────────┐
       │                                                │
┌─────────────┐  1. 认领    ┌──────────────┐  2. 跟进    ┌──────────────┐
│   公海客户   │ ─────────▶ │  我的客户     │ ────────▶  │  客户详情    │
│ (pool)      │            │ (owned)       │            │  写跟进       │
└─────────────┘            └──────┬───────┘            └──────┬───────┘
       ▲                         │ 转交 / 释放                 │
       │                         ▼                              │
       │                  ┌──────────────┐                     │
       └──── 释放 ────── │   部门客户    │ ◀──── 销售主管 ───┘
                          └──────────────┘    看部门全量
```

- **销售**：`登录 → 工作台 → 我的客户 → 客户详情 → 写跟进 / 编辑 / 释放 / 转交 / 删除`。
- **公海**：`登录 → 工作台 → 公海 → 认领`（任何人都可认领，竞争时 CAS 兜底）。
- **销售主管**：`登录 → 我的客户` 自动多看到本部门其他销售的客户。

---

## 3. 功能清单

### 3.1 客户（Customer）

| 字段 | 含义 |
| --- | --- |
| `name` | 客户名称（必填，最长 200） |
| `type` | `enterprise` / `individual`（默认企业） |
| `code` | 客户编号（可选，唯一） |
| `statusId` | 客户状态（关联 `crm_customer_status`，如"初步沟通 / 已流失"） |
| `sourceId` | 客户来源（关联 `crm_customer_source`，如"官网 / 转介绍"） |
| `level` | 客户等级（自定义字符串） |
| `industry` | 所属行业 |
| `phone` / `website` / `province` / `city` / `address` | 联系方式与地址 |
| `ownerUserId` / `ownerDepartmentId` | 负责人 + 所属部门 |
| `poolStatus` | `owned`（已分配）/ `public`（公海）；新建无负责人时默认 `public` |
| `lastFollowUpAt` / `nextFollowUpAt` | 最近 / 下次跟进时间，写跟进时自动维护 |
| `tagIds` | 客户标签（多对多，通过 `crm_customer_tag` 桥接） |
| `remark` | 备注（最长 2000） |

**客户操作：**

- 新建：自动按企业 / 个人两套规则做查重；命中时返回 `CRM_CUSTOMER_DUPLICATE` 并携带已存在客户 ID / 负责人。
- 查看详情：返回基本信息 + `tagIds` + 负责人名 + 状态名 + 来源名 + 主联系人。
- 编辑：改了 `name / phone / type` 会重新查重。**公海客户不能直接编辑**，必须先认领。
- 删除：软删（写 `deleted_at`）。
- 流转：见 §7。

### 3.2 联系人（Contact）

隶属于客户（`crm_contact.customer_id`）。

| 字段 | 含义 |
| --- | --- |
| `name` | 联系人姓名（必填） |
| `gender` | 0 = 未知，1 = 男，2 = 女 |
| `mobile` / `phone` / `email` | 联系方式 |
| `department` / `position` | 部门 / 职位 |
| `isPrimary` | 是否主联系人（同一客户建议只设置 1 个；前端约束，DB 层不强制唯一） |
| `birthday` / `remark` | 生日 / 备注 |

### 3.3 跟进记录 / 活动（Activity）

每次与客户的交互记一条 activity。

| 字段 | 含义 |
| --- | --- |
| `customerId` / `contactId` | 客户 / 联系人（可选） |
| `type` | `phone` / `wechat` / `visit` / `meeting` / `email` / `other` |
| `content` | 跟进内容（必填，最长 2000） |
| `occurredAt` | 发生时间（默认现在） |
| `nextFollowUpAt` | 计划的下次跟进时间（可选，写入客户 `next_follow_up_at`） |
| `operatorUserId` | 操作人（当前用户） |

**关键不变量：** 写跟进 → `crm_activity` 插入 + `crm_customer.last_follow_up_at` / `next_follow_up_at` 更新 **同一事务**。失败整体回滚，避免出现"记录写了但客户时间没刷"。

### 3.4 公海（Pool）

- 公海 = `pool_status = 'public'` 的客户集合，所有人可见、任何人都可认领。
- 客户被新建时若指定了 `ownerUserId`，初始为 `owned`；未指定则进公海。
- 公海客户只允许 2 个动作：查看 / 认领；编辑 / 删除 / 写跟进都需要先认领。

### 3.5 工作台（Dashboard）

6 个核心计数器 + 2 个列表：

| 计数器 | 含义 |
| --- | --- |
| `myCustomers` | 我名下的客户（`owner_user_id = me` 且 `pool_status = owned`） |
| `pendingFollowUp` | 我名下 `next_follow_up_at` 不为空的客户 |
| `todayNew` | 今日新增（`created_at >= 今日 00:00`） |
| `publicPool` | 公海客户总数 |
| `weekFollowUps` | 最近 7 天内的跟进记录数 |
| `monthNew` | 本月新增客户数 |

- 待跟进客户：按 `nextFollowUpAt` 升序取前 10。
- 最近动态：取最近 15 条 activity，附带操作人 / 客户。

> ⚠️ 当前实现里，`myCustomers` / `pendingFollowUp` / `publicPool` / `monthNew` 不按"数据范围"过滤（见 §5 说明）。

### 3.6 设置（Settings）

- **客户标签**：CRUD；`name` 唯一；`enabled=0` 时不再展示给新客户选用，但已绑定的标签保留。
- **客户状态**：CRUD；`name` 唯一；`isSystem=1` 的系统状态不可删除（`code` / `type` / `isSystem` 也不可改）。
- **客户来源**：CRUD；`name` 唯一。

---

## 4. 实体关系

```
crm_customer (1) ──< (N) crm_contact         ← 客户 ↔ 联系人
crm_customer (1) ──< (N) crm_activity        ← 客户 ↔ 跟进记录
crm_customer (N) ──< (N) crm_tag             ← 客户 ↔ 标签（crm_customer_tag 桥接）
crm_customer (1) ──< (N) crm_customer_transfer  ← 客户流转日志

crm_customer.statusId   → crm_customer_status.id
crm_customer.sourceId   → crm_customer_source.id
crm_customer.ownerUserId         → sys_user.id         （Core 表）
crm_customer.ownerDepartmentId   → sys_department.id    （Core 表）
```

CRM 不创建独立的 user / department 表，身份全部来自 Core。模块互不 import；跨模块信息通过 HTTP 或 Core 扩展获取。

---

## 5. 数据范围（DataScope）

CRM 内部以 `schemas/data-scope.ts` 的 `computeDataScope(currentUser)` 实现 3 档可见性：

| 角色 | 范围 | SQL 行为 |
| --- | --- | --- |
| `super_admin` | ALL | 不过滤 owner |
| `sales_lead` | DEPARTMENT | `owner_user_id = me` 或 `owner_department_id ∈ my.deptIds` |
| 其他（含 `sales`） | SELF | `owner_user_id = me` |

- **业务侧额外规则**：公海客户（`pool_status = 'public'`）所有人可见。
- **写权限**：仅 owner / 部门成员 / super_admin 能编辑 / 写跟进 / 删除；公海客户必须先认领。

> Yishan Core 已有 `sys_role.dataScope` 字段但尚未在 Repository / Service 层自动改写 SQL，CRM 先以本地实现满足 MVP；后续由 Core 抽出通用能力，CRM 再对齐。

---

## 6. 字典与预置数据

由 `drizzle/0000_init.sql` 在迁移时插入：

### 客户状态（`crm_customer_status`，6 条系统预置）

| name | code | type | sort | isSystem |
| --- | --- | --- | --- | --- |
| 待跟进 | pending | active | 1 | 1 |
| 初步沟通 | contacted | active | 2 | 1 |
| 需求确认 | qualified | active | 3 | 1 |
| 方案报价 | proposal | active | 4 | 1 |
| 已成交 | won | won | 5 | 1 |
| 已流失 | lost | lost | 6 | 1 |

`isSystem=1` 的状态不可删除（仅允许改 `name` / `sort` / `enabled`）。

### 客户来源（`crm_customer_source`，9 条预置）

| name | code | sort |
| --- | --- | --- |
| 主动开发 | outbound | 1 |
| 客户转介绍 | referral | 2 |
| 官网 | website | 3 |
| 电话咨询 | phone_inquiry | 4 |
| 线下活动 | offline_event | 5 |
| 抖音 | douyin | 6 |
| 小红书 | xiaohongshu | 7 |
| 微信 | wechat | 8 |
| 其他 | other | 99 |

### 客户标签（`crm_tag`）

不在 SQL 初始化里预置；由管理员在"CRM 设置 → 客户标签"页面按需创建。

---

## 7. 关键业务规则

### 7.1 客户流转：claim / release / transfer

由 `actions/customer-flow.ts` 实现，统一在 `CustomerRepository` 一层写主表 + `crm_customer_transfer` 写日志，**同一事务**。

| 动作 | 触发条件 | 副作用 |
| --- | --- | --- |
| **认领**（claim） | 客户当前 `pool_status = 'public'` | `owner_user_id = me`、`owner_department_id = myDeptId`、`pool_status = 'owned'`；写 transfer `type=claim` |
| **释放**（release） | 客户当前 `owner_user_id = me` 且 `pool_status = 'owned'` | 清空 owner、置 `pool_status = 'public'`；写 transfer `type=release`；可附 `reason` |
| **转交**（transfer） | 客户存在；`targetUserId ≠ me`（业务校验） | `owner_user_id = targetUserId`、`pool_status = 'owned'`（部门暂不同步，见 TODO）；写 transfer `type=transfer`；可附 `reason` |

**并发认领**：claim 用 SQL `UPDATE ... WHERE pool_status = 'public'` 的 CAS 守卫，并发情况下只有一条 UPDATE 能命中行。业务层根据 `affectedRows`：

- `affectedRows = 1`：认领成功。
- `affectedRows = 0`：再读一次判定语义——`不存在 → NOT_FOUND`，`已被认领 → ALREADY_OWNED`，`不在公海 → NOT_IN_POOL`。

### 7.2 公海客户不能直接编辑 / 删除

`CustomerService.assertCanOperate` 强制：公海客户只允许 `claim`，不允许 `update` / `delete`；写跟进也要求 `inUserScope` / `inDeptScope`。**结论**：要动公海客户的字段 / 写跟进，必须先认领。

### 7.3 写跟进事务

`ActivityService.create` 在 `dbManager.transaction(...)` 里：

1. 插入 `crm_activity`。
2. 更新 `crm_customer.last_follow_up_at = occurredAt`；若 `nextFollowUpAt` 不为空，同步更新 `crm_customer.next_follow_up_at`。
3. 失败整体回滚。

### 7.4 客户查重

按客户类型走两套规则（`CustomerRepository.findDuplicate`）：

- **企业客户**（`type = enterprise`）：按 `name` 精确匹配为主，`phone` 辅助。
- **个人客户**（`type = individual`）：按 `phone` 优先匹配。

命中后抛 `CRM_CUSTOMER_DUPLICATE(33002)`，并把已存在客户的 `id` / `name` / `ownerUserId` / `ownerUserName` 写入 `BusinessError.details`，前端可提示"已有该客户，由 XXX 跟进"。

### 7.5 系统保护状态

`is_system = 1` 的客户状态：
- **不可删除**（CRM_STATUS_SYSTEM_PROTECTED）。
- **不可改** `code` / `type` / `isSystem`；只允许改 `name` / `sort` / `enabled`（由 `StatusUpdateReqSchema` 控制）。

### 7.6 唯一性约束

| 实体 | 唯一字段 | 索引 |
| --- | --- | --- |
| 客户 | `code` | `uniq_crm_customer_code` |
| 客户标签 | `name` | `uniq_crm_tag_name` |
| 客户状态 | `name` | `uniq_crm_customer_status_name` |
| 客户来源 | `name` | `uniq_crm_customer_source_name` |
| 客户-标签 | `(customer_id, tag_id)` | `uniq_crm_customer_tag` |

---

## 8. 权限码

| code | 含义 | 出现在 |
| --- | --- | --- |
| `crm:dashboard:view` | 查看工作台 | 工作台 |
| `crm:customer:list` | 客户列表 / 详情查看 | 我的客户 / 客户详情 |
| `crm:customer:detail` | 客户详情查看 | 客户详情 |
| `crm:customer:create` | 新建客户 | 我的客户 |
| `crm:customer:update` | 编辑客户 | 我的客户 / 客户详情 |
| `crm:customer:delete` | 删除客户（软删） | 我的客户 / 客户详情 |
| `crm:customer:claim` | 认领公海客户 | 公海 / 我的客户 |
| `crm:customer:release` | 释放客户到公海 | 客户详情 |
| `crm:customer:transfer` | 转交客户 | 客户详情 |
| `crm:customer:member` | 管理客户协同人 | 客户详情 |
| `crm:customer:trash` | 查看回收站 | 客户回收站 |
| `crm:customer:restore` | 从回收站恢复 | 客户回收站 |
| `crm:customer:purge` | 永久删除客户 | 客户回收站 |
| `crm:pool:list` | 公海列表 | 公海 |
| `crm:contact:list` | 联系人查看 | 联系人 |
| `crm:contact:create` | 新建联系人 | 客户详情 |
| `crm:contact:update` | 编辑联系人 | 客户详情 |
| `crm:contact:delete` | 删除联系人 | 客户详情 |
| `crm:activity:list` | 跟进列表 | 跟进记录 |
| `crm:activity:create` | 写跟进 | 客户详情 / 跟进记录 |
| `crm:activity:update` | 编辑跟进 | 跟进记录 |
| `crm:activity:delete` | 删除跟进 | 跟进记录 |
| `crm:settings:view` | 查看设置 | CRM 设置 |
| `crm:settings:update` | 编辑设置 | CRM 设置 |

权限声明集中在每个 route 文件的 `registerPermissions(...)`，启动期注入 `PERMISSION_CODES` 集合。

---

## 9. 业务错误码

CRM 不进 Core 合并表，业务异常以 `BusinessError(code, message)` 抛出。

### 客户（330xx）

| code | 数值 | 触发条件 | 前端建议 |
| --- | --- | --- | --- |
| `CRM_CUSTOMER_NOT_FOUND` | 33001 | 客户不存在或已删除（含数据范围校验失败时的复用，避免泄漏存在性） | 提示并返回列表 |
| `CRM_CUSTOMER_DUPLICATE` | 33002 | 新建 / 编辑时按企业 / 个人规则命中已存在客户 | 展示 `existingCustomerName` / `ownerUserName`，引导跳转 |
| `CRM_CUSTOMER_ALREADY_OWNED` | 33003 | 并发认领失败，客户已不在公海 | 刷新页面，提示"已被 XX 认领" |
| `CRM_CUSTOMER_NOT_IN_POOL` | 33004 | 公海客户不能直接编辑 / 释放；或认领时不在公海 | 引导先认领 |
| `CRM_CUSTOMER_TRANSFER_FORBIDDEN` | 33005 | 数据范围外无权编辑 / 删除 / 转交 | 提示无权限 |
| `CRM_CUSTOMER_RELEASE_FORBIDDEN` | 33006 | 释放非自己名下的客户 | 提示只能释放自己的客户 |
| `CRM_CUSTOMER_TYPE_INVALID` | 33007 | 客户类型不是 enterprise / individual | 表单校验已挡住，服务层兜底 |
| `CRM_CUSTOMER_OWNER_REQUIRED` | 33008 | 客户必须有负责人（场景占位，当前未使用） | — |
| `CRM_CUSTOMER_TRANSFER_TARGET_INVALID` | 33009 | 转交目标是自己 | 提示目标无效 |

### 联系人（331xx）

| code | 数值 | 触发条件 |
| --- | --- | --- |
| `CRM_CONTACT_NOT_FOUND` | 33101 | 联系人不存在或已删除 |
| `CRM_CONTACT_CUSTOMER_MISMATCH` | 33102 | 联系人 customerId 不匹配（占位，当前未触发） |

### 跟进（332xx）

| code | 数值 | 触发条件 |
| --- | --- | --- |
| `CRM_ACTIVITY_NOT_FOUND` | 33201 | 跟进不存在 |
| `CRM_ACTIVITY_CONTENT_REQUIRED` | 33202 | content 必填（schema 已约束） |
| `CRM_ACTIVITY_TYPE_INVALID` | 33203 | type 不在枚举内 |

### 设置（333xx）

| code | 数值 | 触发条件 |
| --- | --- | --- |
| `CRM_TAG_NOT_FOUND` | 33301 | 标签不存在 |
| `CRM_TAG_NAME_DUPLICATE` | 33302 | 标签名称重复 |
| `CRM_STATUS_NOT_FOUND` | 33311 | 客户状态不存在（绑定客户时被引用） |
| `CRM_STATUS_NAME_DUPLICATE` | 33312 | 客户状态名称重复 |
| `CRM_STATUS_SYSTEM_PROTECTED` | 33313 | 试图删除 / 改 `is_system=1` 的状态 |
| `CRM_SOURCE_NOT_FOUND` | 33321 | 客户来源不存在 |
| `CRM_SOURCE_NAME_DUPLICATE` | 33322 | 客户来源名称重复 |

---

## 10. API 概览

> 完整 TypeBox schema 见 `schemas/*.schema.ts`。下面是按业务动线组织的最小映射表，便于产品 / 前后端对齐。

### 10.1 工作台

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/crm/v1/dashboard` | 工作台（计数器 + 待跟进 + 最近动态） |

### 10.2 客户

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/crm/v1/customers` | 客户列表（自动套数据范围 + 公海；支持 view / keyword / sortBy / 高级筛选） |
| GET | `/api/crm/v1/customers/:id` | 客户详情（基础 + 标签 + 负责人 + 主联系人） |
| POST | `/api/crm/v1/customers` | 新建客户（含查重 + 标签） |
| PATCH | `/api/crm/v1/customers/:id` | 更新客户（公海客户拒绝；改了关键字段重查重） |
| DELETE | `/api/crm/v1/customers/:id` | 软删客户（需在数据范围内） |
| GET | `/api/crm/v1/customers/trash` | 回收站列表（同套数据范围 + 公海） |
| POST | `/api/crm/v1/customers/:id/restore` | 从回收站恢复（CAS，幂等） |
| DELETE | `/api/crm/v1/customers/:id/purge` | 永久删除（仅删回收站里的；清理标签 / 协同人） |
| GET | `/api/crm/v1/customers/:id/members` | 客户协同人列表 |
| POST | `/api/crm/v1/customers/:id/members` | 添加协同人（`{ userId }`） |
| DELETE | `/api/crm/v1/customers/:id/members/:userId` | 移除协同人 |
| POST | `/api/crm/v1/customers/:id/claim` | 认领公海客户 |
| POST | `/api/crm/v1/customers/:id/release` | 释放客户到公海 |
| POST | `/api/crm/v1/customers/:id/transfer` | 转交客户（请求体：`targetUserId` + 可选 `reason`） |

### 10.3 公海

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/crm/v1/pool` | 公海客户列表（`pool_status = public`） |

### 10.4 联系人

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/crm/v1/contacts` | 联系人列表（支持按 `customerId` / `isPrimary` 筛选） |
| POST | `/api/crm/v1/contacts` | 新建联系人 |
| PATCH | `/api/crm/v1/contacts/:id` | 更新联系人 |
| DELETE | `/api/crm/v1/contacts/:id` | 删除联系人 |

### 10.5 跟进

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/crm/v1/customers/:customerId/activities` | 客户的跟进列表 |
| POST | `/api/crm/v1/customers/:customerId/activities` | 新建跟进（同步重算客户时间） |
| GET | `/api/crm/v1/activities/:id` | 按 id 读取跟进 |
| PATCH | `/api/crm/v1/activities/:id` | 编辑跟进（同步重算客户时间） |
| DELETE | `/api/crm/v1/activities/:id` | 删除跟进（软删，同步重算客户时间） |

### 10.6 设置

| Method | Path | 说明 |
| --- | --- | --- |
| GET / POST / PATCH / DELETE | `/api/crm/v1/settings/tags` | 客户标签 |
| GET / POST / PATCH / DELETE | `/api/crm/v1/settings/statuses` | 客户状态 |
| GET / POST / PATCH / DELETE | `/api/crm/v1/settings/sources` | 客户来源 |

---

## 11. 目录结构

```
modules/crm/
├── README.md                          ← 本文档
├── module.ts                          ← meta: { id: 'crm', enabled: true }
├── db/schema.ts                       ← 8 张表（crm_customer / contact / activity / tag / customer_tag / status / source / transfer）
├── drizzle.config.ts
├── drizzle/0000_init.sql              ← 表 + 预置 status / source
├── drizzle/meta/_journal.json + 0000_snapshot.json
├── config/system-menu.json            ← 菜单树 + 权限码绑定
├── seed.ts                            ← 写入 sys_menu + sys_menu_permission
├── repositories/                      ← 唯一允许 import @/db 的层
│   ├── customer.repository.ts
│   ├── contact.repository.ts
│   ├── activity.repository.ts
│   ├── tag.repository.ts
│   ├── status.repository.ts
│   ├── source.repository.ts
│   ├── transfer.repository.ts
│   └── dashboard.repository.ts
├── services/                          ← 业务编排；不动 SQL
│   ├── customer.service.ts
│   ├── contact.service.ts
│   ├── activity.service.ts
│   ├── settings.service.ts
│   └── dashboard.service.ts
├── actions/customer-flow.ts           ← claim / release / transfer 三个 action
├── schemas/
│   ├── common.schema.ts               ← PaginationQuerySchema
│   ├── customer.schema.ts             ← TypeBox: 客户 / 列表 / 详情 / 流转请求
│   ├── contact.schema.ts
│   ├── activity.schema.ts             ← 含 ACTIVITY_TYPES 枚举
│   ├── dashboard.schema.ts
│   ├── settings.schema.ts             ← tag / status / source
│   ├── data-scope.ts                  ← computeDataScope(currentUser)
│   ├── error-codes.ts                 ← 330xx/331xx/332xx/333xx
│   └── routes.schema.ts
├── routes/v1/
│   ├── customers/index.ts             ← CRUD + claim/release/transfer
│   ├── contacts/index.ts              ← 独立联系人列表
│   ├── activities/index.ts            ← /customers/:customerId/activities
│   ├── pool/index.ts                  ← 公海
│   ├── dashboard/index.ts             ← 工作台
│   └── settings/index.ts              ← tags / statuses / sources
└── tests/                             ← vitest 单测
    ├── activity-service.test.ts
    ├── customer-service.test.ts
    ├── data-scope.test.ts
    └── settings-service.test.ts
```

---

## 12. 架构约定（对齐 Yishan 模块规范）

- **表名前缀**：所有表 `crm_` 开头（由 `scripts/check-module-naming.mjs` 在 lint 阶段校验）。
- **路由前缀**：硬约定 `/api/crm/v1/...`，模块不声明。
- **模块边界**：
  - 路由层只做参数校验 + 调 service；**不直接 import drizzle / 不写 SQL**。
  - repository 层是唯一允许 `@/db` 的层。
  - service 层做编排，跨模块信息走 HTTP 或 Core 扩展，不 join 别人的表。
- **数据范围**：模块内 `data-scope.ts` 自实现 `computeDataScope`，未来 Core 抽出通用能力时对齐。
- **模块启停**：由 `sys_module.enabled` 控制；首次 sync 用 `meta.enabled`，后续永不被覆盖。运行时切换通过 dev-only API。

详见根 `CLAUDE.md` / `docs/module-onboarding.md`。

---

## 13. 跑迁移 / 测试

```bash
cd apps/yishan-api

# 1. 灌表（crm_customer / contact / activity / tag / customer_tag / status / source / transfer）
npx drizzle-kit --config=src/modules/crm/drizzle.config.ts generate
npx drizzle-kit --config=src/modules/crm/drizzle.config.ts migrate

# 2. 跑模块 seed：写入 sys_menu + sys_menu_permission
pnpm db:seed

# 3. 单测
npx vitest run src/modules/crm/tests
```

> 数据库 schema 改动必须同步提交 `drizzle/0000_init.sql` + `drizzle/meta/_journal.json` + `drizzle/meta/0000_snapshot.json` 三件套，不能只改 `db/schema.ts`。

---

## 14. 前端页面（apps/yishan-admin）

由 `apps/yishan-admin/plugin.ts` 自动扫描 `apps/yishan-admin/src/modules/crm/pages/<page>/index.tsx`：

| 路由 | 组件 | 说明 |
| --- | --- | --- |
| `/crm/dashboard` | `./modules/crm/dashboard` | 工作台（6 计数器 + 待跟进 + 最近动态） |
| `/crm/customers` | `./modules/crm/customers` | 我的客户（ProTable，含查重 / 标签） |
| `/crm/customer-detail` | `./modules/crm/customer-detail` | 客户详情（最近跟进 + 信息摘要 + 联系人 + 跟进 + 流转） |
| `/crm/pool` | `./modules/crm/pool` | 公海（ProTable + 一键认领） |
| `/crm/contacts` | `./modules/crm/contacts` | 联系人（独立列表） |
| `/crm/settings/tags` | `./modules/crm/settings/tags` | 客户标签 |
| `/crm/settings/statuses` | `./modules/crm/settings/statuses` | 客户状态 |
| `/crm/settings/sources` | `./modules/crm/settings/sources` | 客户来源 |

`/crm/customer-detail` 通过 query string `?id=<customerId>` 跳转进入。

---

## 15. 已知边界 / 后续 TODO

- **租户隔离（明确不做）**：Yishan Core 完全没有 `tenant` / `tenantId` 概念（`grep -i tenant src/core` 0 命中），
  应用按单租户设计。CRM 不为单租户实现一遍假 `tenant_id` 字段，等 Core 抽出真正的租户底座再统一接入。
- **审计日志**：Core 当前仅 `core/plugins/external/audit.ts` 通过 fastify 日志输出（未建表 / 未写库）。
  CRM 关键行为（创建 / 修改 / 转移 / 释放 / 领取 / 软删）目前靠 `crm_customer_transfer` + 客户自身的 `updated_at` 留痕，
  待 Core 给出 `sys_oper_log` 后对齐接入。
- **领域事件**：Core 无 EventBus / 发布订阅基建，CRM 不自建事件总线。
  Service 层留有清晰的"业务动作 → 状态变更"入口，将来加事件适配器只需在 service 内插桩。
- **导入 / 导出**：线索池已支持 Excel / CSV 批量导入；其他业务对象暂未提供批量导入导出。
- **工作台计数器的数据范围**：`myCustomers` / `pendingFollowUp` / `publicPool` / `monthNew` 当前直接按 `crm_customer` 全表聚合（不按角色过滤）；`sales_lead` / `sales` 看到的是"全公司口径"。后续按角色过滤需要重写 `DashboardRepository.countWhere`。
- **转交后的部门归属**：当前 `transfer` 时 `owner_department_id` 留空，依赖后续"完善 User 信息"动作补齐；严谨实现应查 `UserService.getUserById().deptIds[0]`，但 CRM 不跨模块 join，留待 Core 给出稳定 API。
- **主联系人唯一性**：当前靠前端约束；DB 未限制 `is_primary=1` 在同一客户下唯一。
- **客户类型与查重**：当前企业按 `name` 精确、个人按 `phone`；尚未做模糊匹配与归一化（去空格、统一格式）。
- **未实现**：商机 / 合同 / 订单、审批 / 工作流、营销自动化、自定义字段。

---

## 16. 相关参考

- Yishan 仓库根：`apps/yishan-api/src/modules/crm/`
- 模块开发指南：`apps/yishan-api/docs/module-onboarding.md`（仓库根 `docs/module-onboarding.md`）
- 模块系统总览：根 `CLAUDE.md` "Architecture: the module system"
- OpenAPI 规范：`apps/yishan-api/src/modules/crm/schemas/*.schema.ts`（TypeBox）；生成产物 `apps/yishan-admin/src/services/crm.ts`
- 前端 OpenAPI 同步：`pnpm --filter yishan-admin openapi`
