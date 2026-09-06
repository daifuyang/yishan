# CRM 模块

> Yishan 通用业务插件的第一份"完整范例"：客户 / 联系人 / 跟进 / 公海 / 认领 / 释放 / 转交 / 设置。

按当前 Yishan 模块规范落地：所有表 `crm_*` 前缀，路由 prefix `/api/crm`，菜单由 `config/system-menu.json` 自描述，seed 由 `seed.ts` 写入 sys_menu + sys_menu_permission。

## 范围

**MVP 包含：**
- 客户 CRUD + 查重
- 联系人 CRUD
- 跟进记录（activity）—— 写跟进同步更新 `last_follow_up_at` / `next_follow_up_at`，同一事务
- 客户标签 / 客户状态 / 客户来源（字典类 CRUD）
- 公海（poolStatus = public）+ 认领 / 释放 / 转交（action）
- 工作台：我的客户 / 待跟进 / 今日新增 / 公海 / 本周跟进 / 本月新增 + 最近动态

**MVP 不包含：**
- 线索 / 商机 / 合同 / 订单 / 报价 / 发票
- 复杂审批 / 工作流 / 营销自动化
- 自定义字段平台 / 页面设计器 / 状态机 DSL

## 线索运营闭环（CRM Lead Lifecycle）

线索（lead）状态是业务事实，只描述当前线索处于哪个处理阶段：

| 状态 | 含义 |
| --- | --- |
| 待处理（new） | 线索新建后尚未产生处理结论 |
| 跟进中（processing） | 首次保存一条真实跟进后自动进入；正在验证对象与机会 |
| 有效（qualified） | 经资格判定通过，需要可联系渠道 + 资格证据 + 下一步 |
| 无效（disqualified） | 受控作废；记录标准化原因 code 与解释 |
| 已转化（converted） | 已成功关联/创建客户 + 联系人；**不是成交** |

关键约束：

- 负责人、公海归属、下次跟进时间、是否逾期 **都是独立维度**，不能改变 `status`。
- 第一次真实跟进自动从 `new → processing`；后续跟进不再改变状态。
- 只有 `qualified` 可以转为客户。转化表示客户与联系人已关联或创建，**不代表成交**。
- 只有 `disqualified` 可以"重新激活"，回到 `processing`；已转化线索不可重新激活。
- 任何状态变化在 `crm_lead_activity` 留痕；普通 `PATCH /leads/:id` 不能改写 `status`、作废原因、转化引用、负责人。

作废原因 code（必填，七选一）：`duplicate / not_target / no_demand / unreachable / invalid_contact / rejected / other`。

权限码：

- `crm:lead:qualify` 判为有效（要求证据 + 下一步）
- `crm:lead:disqualify` 作废（要求标准化 code + 解释）
- `crm:lead:reactivate` 重新激活（要求原因）
- `crm:lead:convert` 转为客户（包含 preview + convert 两个端点）

API 端点（线索下新增）：

| Method | Path | 说明 |
| --- | --- |
| POST | `/api/crm/v1/leads/:id/qualify` | 判为有效，必填 evidence / nextAction |
| POST | `/api/crm/v1/leads/:id/disqualify` | 作废，必填标准化 code / reason |
| POST | `/api/crm/v1/leads/:id/reactivate` | 重新激活，必填 reason |
| GET  | `/api/crm/v1/leads/:id/conversion-preview` | 转化预览：客户候选 + 联系人候选 |
| POST | `/api/crm/v1/leads/:id/convert` | 转为客户，body 同时给出客户与联系人决策 |

`POST /leads/:id/activities` 成功响应从 `{ activity }` 升级为 `{ activity, lead }`，以便 UI 立刻看到首条跟进触发的 `new → processing` 状态变更。

## 目录

```
modules/crm/
├── README.md
├── module.ts                        # meta
├── db/schema.ts                     # crm_customer / crm_lead / crm_lead_activity / crm_contact / crm_activity / crm_tag / crm_customer_tag / crm_customer_status / crm_customer_source / crm_customer_transfer
├── drizzle.config.ts
├── drizzle/0000_init.sql            # 表 + 预置 status / source 数据
├── drizzle/0001_add-leads.sql       # 线索表
├── drizzle/0002_add-lead-activities.sql
├── drizzle/0003_add-lead-wechat.sql
├── drizzle/0004_add-lead-pool-status.sql
├── drizzle/0005_lead-lifecycle-reasons.sql  # disqualify_code
├── drizzle/meta/_journal.json + ...
├── config/system-menu.json          # 菜单树（含判为有效 / 作废 / 重新激活 / 转为客户 四个权限节点）
├── seed.ts                          # 写入 sys_menu + sys_menu_permission
├── repositories/                    # 唯一允许 import @/db 的层
├── services/                        # 业务编排；不动 SQL
│   ├── lead.service.ts              # CRUD / assign / claim / qualify / disqualify / reactivate
│   ├── lead-activity.service.ts     # 写跟进 → first follow-up 自动推进 new→processing
│   ├── lead-conversion.service.ts   # 转化预览 / 转化（事务内锁 + 关联 + 状态转换）
│   └── ...
├── actions/customer-flow.ts         # claim / release / transfer 三个 action
├── schemas/                         # TypeBox HTTP schema + 错误码 + 数据范围
├── routes/v1/
│   ├── customers/index.ts           # CRUD + claim/release/transfer
│   ├── contacts/index.ts            # 独立联系人列表
│   ├── activities/index.ts          # /customers/:customerId/activities
│   ├── leads/index.ts               # CRUD + 判为有效 / 作废 / 重新激活 / 转为客户
│   ├── pool/index.ts                # 公海
│   ├── dashboard/index.ts           # 工作台
│   └── settings/index.ts            # tags / statuses / sources
└── tests/                           # vitest 单测
```

## 关键约定

- **数据范围（DataScope）**：CRM 内部以 `schemas/data-scope.ts` 的 `computeDataScope()` 实现 SELF / DEPARTMENT / ALL 三档。Yishan Core 暂时还没有通用 DataScope；CRM 把这层独立实现，等 Core 抽出通用能力时再合并。
  - `super_admin` → ALL
  - `sales_lead`（role.code 含此 code）→ DEPARTMENT（ownerDepartmentId ∈ currentUser.deptIds）
  - 默认 → SELF（ownerUserId = currentUser.id）

- **认领并发**：claim 用 SQL `WHERE pool_status = 'public'` CAS 守卫，并发情况下只有一条 UPDATE 能命中行；业务层根据 affectedRows 区分"被抢" / "非公海"。

- **写跟进事务**：`crm_activity` INSERT + `crm_customer.last_follow_up_at` / `next_follow_up_at` UPDATE 在同一事务，失败整体回滚。

- **首条跟进推进状态**：`crm_lead_activity` INSERT + `crm_lead.status='processing'` UPDATE + 第二条 `status_change` 审计活动在同一事务，仅在原本 status='new' 时推进。

- **公海客户不能直接编辑**：必须先认领；service.assertCanOperate 抛 CRM_CUSTOMER_NOT_IN_POOL。

- **唯一性**：客户按企业 / 个人两条规则查重。标签 / 状态 / 来源按 name 唯一；状态 `is_system=1` 不可删除。

## 权限码

| code | 含义 |
| --- | --- |
| `crm:dashboard:view` | 工作台 |
| `crm:customer:list` / `detail` / `create` / `update` / `delete` | 客户 CRUD |
| `crm:customer:claim` / `release` / `transfer` | 客户流转 |
| `crm:contact:list` / `create` / `update` / `delete` | 联系人 |
| `crm:activity:list` / `create` | 跟进 |
| `crm:lead:list` / `create` / `update` | 线索查看 / 新建 / 编辑资料 |
| `crm:lead:claim` / `assign` / `return` | 线索领取 / 分配 / 退回公海 |
| `crm:lead:qualify` | 判为有效 |
| `crm:lead:disqualify` | 作废 |
| `crm:lead:reactivate` | 重新激活 |
| `crm:lead:convert` | 转为客户 |
| `crm:pool:list` | 公海 |
| `crm:settings:view` / `update` | 设置 |

权限声明集中在 `schemas/permissions.ts`，启动期注入 `PERMISSION_CODES` 集合。

## API

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/crm/v1/dashboard` | 工作台 |
| GET | `/api/crm/v1/customers` | 客户列表 |
| GET | `/api/crm/v1/customers/:id` | 客户详情 |
| POST | `/api/crm/v1/customers` | 新建客户（含查重 + 标签） |
| PATCH | `/api/crm/v1/customers/:id` | 更新客户 |
| DELETE | `/api/crm/v1/customers/:id` | 软删客户 |
| POST | `/api/crm/v1/customers/:id/claim` | 认领公海客户 |
| POST | `/api/crm/v1/customers/:id/release` | 释放客户到公海 |
| POST | `/api/crm/v1/customers/:id/transfer` | 转交客户 |
| GET | `/api/crm/v1/pool` | 客户公海 |
| GET | `/api/crm/v1/contacts` | 联系人列表 |
| POST | `/api/crm/v1/contacts` | 新建联系人 |
| PATCH | `/api/crm/v1/contacts/:id` | 更新联系人 |
| DELETE | `/api/crm/v1/contacts/:id` | 删除联系人 |
| GET | `/api/crm/v1/customers/:customerId/activities` | 客户跟进 |
| POST | `/api/crm/v1/customers/:customerId/activities` | 新建跟进 |
| GET | `/api/crm/v1/leads` | 线索列表 |
| POST | `/api/crm/v1/leads` | 新建线索 |
| PATCH | `/api/crm/v1/leads/:id` | 编辑线索普通资料（不接受 status / 归属 / 转化字段） |
| POST | `/api/crm/v1/leads/:id/assign` | 转移负责人 |
| POST | `/api/crm/v1/leads/:id/claim` | 领取公海线索 |
| POST | `/api/crm/v1/leads/:id/qualify` | 判为有效 |
| POST | `/api/crm/v1/leads/:id/disqualify` | 作废 |
| POST | `/api/crm/v1/leads/:id/reactivate` | 重新激活 |
| GET  | `/api/crm/v1/leads/:id/conversion-preview` | 转化预览 |
| POST | `/api/crm/v1/leads/:id/convert` | 转为客户 |
| GET | `/api/crm/v1/leads/:id/activities` | 线索跟进记录 |
| POST | `/api/crm/v1/leads/:id/activities` | 新建线索跟进（首次跟进自动 new → processing） |
| GET / POST / PATCH / DELETE | `/api/crm/v1/settings/tags` | 标签 |
| GET / POST / PATCH / DELETE | `/api/crm/v1/settings/statuses` | 客户状态 |
| GET / POST / PATCH / DELETE | `/api/crm/v1/settings/sources` | 客户来源 |

## 跑迁移

```bash
cd apps/yishan-api
npx drizzle-kit --config=src/modules/crm/drizzle.config.ts generate
npx drizzle-kit --config=src/modules/crm/drizzle.config.ts migrate
pnpm db:seed     # 触发 seed.ts 写 sys_menu + sys_menu_permission
```

## 测试

```bash
cd apps/yishan-api
npx vitest run src/modules/crm/tests
```

## 前端

`apps/yishan-admin/src/modules/crm/pages/<page>/index.tsx`：
- `dashboard` —— 工作台
- `customers` —— 我的客户列表
- `customer-detail` —— 客户详情（含联系人 / 跟进 / 流转 Tab）
- `pool` —— 公海
- `contacts` —— 联系人列表
- `leads` —— 线索列表（按状态显示操作：查看 / 写跟进 / 转移 / 判为有效 / 作废 / 重新激活 / 转为客户）
- `lead-pool` —— 线索公海
- `settings/tags`、`settings/statuses`、`settings/sources` —— 设置

由 `apps/yishan-admin/plugin.ts` 自动扫描，无需手动注册。
