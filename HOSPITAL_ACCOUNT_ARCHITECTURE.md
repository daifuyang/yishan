# 医院多账号体系最终实现方案

## 1. 背景与目标

当前 CRM 医院管理里，医院账号通过 `CrmHospital.accountUserId` 绑定到一个系统用户。这个设计存在几个问题：

- 一个医院只能绑定一个账号，后续支持多个医院账号会牵动数据库、权限和前端交互。
- 医院编辑表单里手动填写“绑定用户ID”，操作不直观，也容易填错。
- 医院账号的创建、分配和医院资料编辑混在一起，缺少清晰边界。
- 非系统管理员的数据权限依赖 `accountUserId -> hospitalId`，无法自然支持“一个账号管理多个医院”。

旧系统 `kf.iximei.cn` 的交互值得参考：在医院管理里直接添加医院账号，而不是先到用户管理创建用户再回填绑定关系。但旧系统的数据模型是 `user.hospital_id`，本质仍是单医院账号模型，不适合直接复制。

本方案目标：

- 保留系统唯一账号体系，不新增一套医院用户体系。
- 支持一个医院多个账号。
- 支持一个账号管理多个医院。
- 医院账号分配从医院管理入口完成。
- 医院资料编辑和账号管理解耦。
- 权限模型清晰：全局权限归系统角色，医院范围内身份归 CRM 关联关系。

## 2. 核心决策

### 2.1 不新增全局组织管理

v1 不在系统基座上新增全局“组织管理 / 租户管理”。

原因：

- 当前需求只发生在 CRM 医院域内。
- 系统已有 `SysUser`、`SysRole`、`SysUserRole`、`SysDept`，再引入全局组织会扩大改造面。
- 医院账号的数据权限只影响 CRM 医院、派单、医院资料等业务数据，不应污染系统基础权限模型。

后续如果确实需要多租户、集团、机构统一建模，可以再把医院抽象迁移到 `sys_org` 或类似组织模型。

### 2.2 使用系统全局账号与角色

继续使用现有系统基座：

- `SysUser`：唯一登录身份。
- `SysRole`：全局能力角色。
- `SysUserRole`：用户与全局角色关系。

医院账号不是一套新用户，而是普通 `SysUser` 被分配到了某个医院。

### 2.3 新增 CRM 医院账号关系

新增 `CrmHospitalAccount` 表表达医院内成员关系：

- 用户属于哪个医院。
- 用户在该医院内是什么身份。
- 该医院关系是否启用。
- 是否可以管理该医院的其他账号。

医院内角色只在医院范围生效，不等于系统管理员。

## 3. 领域模型

推荐模型关系：

```text
SysUser
  ├─ SysUserRole -> SysRole        # 全局权限
  └─ CrmHospitalAccount            # CRM 医院成员关系

CrmHospital
  └─ CrmHospitalAccount            # 医院账号列表
```

### 3.1 SysUser

全局登录账号。

职责：

- 登录认证。
- 基础个人信息。
- 全局角色绑定。
- 登录状态、密码、安全策略。

不承载医院业务身份字段。

### 3.2 SysRole

全局能力角色。

示例：

- 系统管理员。
- CRM 管理员。
- 医院账号。

全局角色回答的问题是：“这个用户是否有能力进入某个系统模块或执行某类后台操作？”

### 3.3 CrmHospital

医院业务实体。

职责：

- 医院名称、地址、联系方式、经营性质。
- 微信绑定信息。
- 医院介绍、合同资料。
- 派单关联。

医院资料不再直接保存主要账号 ID。

### 3.4 CrmHospitalAccount

医院账号关系表。

建议字段：

```prisma
model CrmHospitalAccount {
  id         Int       @id @default(autoincrement()) @map("id")
  hospitalId Int      @map("hospital_id")
  userId     Int      @map("user_id")
  role       String   @default("member") @map("role") @db.VarChar(20)
  status     Int      @default(1) @map("status") @db.TinyInt
  remark     String?  @map("remark") @db.VarChar(255)
  creatorId  Int      @map("creator_id")
  createdAt  DateTime @default(now()) @map("created_at") @db.DateTime(0)
  updaterId  Int      @map("updater_id")
  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at") @db.DateTime(0)
  deletedAt  DateTime? @map("deleted_at") @db.DateTime(0)

  hospital CrmHospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  user     SysUser     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([hospitalId, userId], map: "uniq_crm_hospital_account")
  @@index([hospitalId], map: "idx_crm_hospital_account_hospital")
  @@index([userId], map: "idx_crm_hospital_account_user")
  @@index([status], map: "idx_crm_hospital_account_status")
  @@map("crm_hospital_account")
}
```

说明：

- `role` 使用字符串，方便未来扩展。
- `status=1` 表示启用，`status=0` 表示停用。
- `deletedAt` 支持软解除关系。
- `@@unique([hospitalId, userId])` 避免重复分配。

## 4. 医院内角色设计

医院内角色推荐：

| 角色 | 含义 | 能力 |
| --- | --- | --- |
| `owner` | 医院负责人 | 管理医院账号、编辑医院资料、查看医院派单 |
| `admin` | 医院管理员 | 编辑医院资料、查看医院派单，可按策略允许管理普通成员 |
| `member` | 普通医院账号 | 查看和处理分配给医院的派单 |

不要使用“医院超管”作为产品术语。建议使用：

- 医院负责人
- 医院管理员
- 普通账号

原因：

- “超管”容易和系统超级管理员混淆。
- 医院内角色只在医院范围内生效。
- 系统级权限仍由 `SysRole` 控制。

## 5. 权限模型

权限分两层。

### 5.1 全局权限

由 `SysRole / SysUserRole` 决定。

示例：

- 是否能进入 CRM。
- 是否能访问医院管理菜单。
- 是否能创建医院。
- 是否能管理全部医院。
- 是否能管理系统用户、角色、菜单。

这部分仍使用现有系统基座，不在 CRM 内重复实现。

### 5.2 医院范围权限

由 `CrmHospitalAccount` 决定。

示例：

- 用户能访问哪些医院。
- 用户在某医院内是否为管理员。
- 用户是否能看到该医院的派单。
- 用户是否能编辑该医院资料。
- 用户是否能管理该医院账号。

规则建议：

- 系统管理员 / CRM 管理员可以看全部医院。
- 普通医院账号只能看自己关联的医院。
- 关联状态为停用或软删除时，不再授予医院访问权限。
- 一个账号关联多个医院时，查询范围使用 `hospitalId in (...)`。

## 6. API 设计

### 6.1 医院 CRUD

医院资料接口保持原路径：

```text
GET    /api/modules/crm/v1/admin/hospitals/
GET    /api/modules/crm/v1/admin/hospitals/:id
POST   /api/modules/crm/v1/admin/hospitals/
PUT    /api/modules/crm/v1/admin/hospitals/:id
DELETE /api/modules/crm/v1/admin/hospitals/:id
```

调整：

- `POST / PUT` 不再接收 `accountUserId`。
- 医院列表返回账号摘要：
  - `accountCount`
  - `ownerAccounts`
  - `adminAccounts`

### 6.2 医院账号管理

新增接口：

```text
GET    /api/modules/crm/v1/admin/hospitals/:id/accounts
POST   /api/modules/crm/v1/admin/hospitals/:id/accounts
POST   /api/modules/crm/v1/admin/hospitals/:id/accounts/assign
PUT    /api/modules/crm/v1/admin/hospitals/:id/accounts/:userId
DELETE /api/modules/crm/v1/admin/hospitals/:id/accounts/:userId
```

#### 获取医院账号

```text
GET /api/modules/crm/v1/admin/hospitals/:id/accounts
```

返回：

```json
{
  "data": [
    {
      "id": 1,
      "hospitalId": 10,
      "userId": 23,
      "role": "owner",
      "status": 1,
      "remark": "",
      "user": {
        "id": 23,
        "username": "hospital_a",
        "realName": "张三",
        "phone": "13800000000",
        "email": "a@example.com",
        "status": "1"
      }
    }
  ]
}
```

#### 新建账号并分配

```text
POST /api/modules/crm/v1/admin/hospitals/:id/accounts
```

请求：

```json
{
  "username": "hospital_a",
  "phone": "13800000000",
  "realName": "张三",
  "email": "a@example.com",
  "password": "abc123",
  "role": "owner",
  "remark": "院方负责人"
}
```

行为：

- 创建 `SysUser`。
- 绑定全局“医院账号”角色。
- 创建 `CrmHospitalAccount`。
- 返回用户和医院关系。

#### 分配已有账号

```text
POST /api/modules/crm/v1/admin/hospitals/:id/accounts/assign
```

请求：

```json
{
  "userId": 23,
  "role": "member",
  "remark": "客服对接人"
}
```

行为：

- 校验用户存在且未删除。
- 校验医院存在且未删除。
- 创建或恢复 `CrmHospitalAccount`。
- 不修改用户密码。
- 不删除用户原有角色。

#### 更新医院内身份

```text
PUT /api/modules/crm/v1/admin/hospitals/:id/accounts/:userId
```

请求：

```json
{
  "role": "admin",
  "status": 1,
  "remark": "运营负责人"
}
```

#### 解除分配

```text
DELETE /api/modules/crm/v1/admin/hospitals/:id/accounts/:userId
```

行为：

- 只软删除或停用医院关系。
- 不删除 `SysUser`。
- 不删除用户全局角色。

## 7. 管理端交互

### 7.1 医院列表

医院列表增加展示：

- 医院名称。
- 账号数。
- 医院负责人。
- 医院管理员。
- 微信绑定状态。
- 状态。

操作列：

- 编辑医院。
- 账号管理。
- 删除医院。

### 7.2 医院编辑

医院编辑弹窗只编辑医院资料。

移除：

- `绑定用户ID`
- 手动填写 `accountUserId`

原因：

- 账号分配是成员管理行为，不是医院资料字段。
- 避免误填用户 ID。
- 为多账号关系留出独立入口。

### 7.3 账号管理弹窗 / 抽屉

从医院列表点击“账号管理”打开。

内容：

- 当前医院账号列表。
- 账号姓名、用户名、手机号、全局状态、医院内角色、医院内状态。
- 新建账号并分配。
- 分配已有账号。
- 设置为负责人 / 管理员 / 普通账号。
- 启用 / 停用。
- 解除分配。

交互建议：

- 使用抽屉而不是大弹窗，方便保留医院列表上下文。
- “新建账号并分配”和“分配已有账号”用 Tabs 或分段控件区分。
- 新建账号时显示初始密码输入框，不自动生成密码。
- 解除分配前二次确认。

## 8. 迁移方案

### 8.1 第一阶段：兼容迁移

新增 `CrmHospitalAccount`，暂时保留 `CrmHospital.accountUserId`。

迁移脚本：

```sql
INSERT INTO crm_hospital_account (
  hospital_id,
  user_id,
  role,
  status,
  creator_id,
  updater_id,
  created_at,
  updated_at
)
SELECT
  id,
  account_user_id,
  'owner',
  1,
  creator_id,
  updater_id,
  NOW(),
  NOW()
FROM crm_hospital
WHERE account_user_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  role = VALUES(role),
  status = VALUES(status),
  updated_at = NOW();
```

### 8.2 第二阶段：业务读写切换

将代码改为：

- 医院列表账号展示从 `CrmHospitalAccount` 聚合。
- 派单权限从 `CrmHospital.accountUserId` 改为 `CrmHospitalAccount.userId`。
- 医院编辑不再写 `accountUserId`。
- 新账号分配只写 `CrmHospitalAccount`。

### 8.3 第三阶段：清理旧字段

稳定运行后单独清理：

- 移除 `CrmHospital.accountUserId`。
- 移除 Prisma 中旧关系 `CrmHospitalAccount` 之外的单账号反向关系。
- 清理旧前端字段和兼容代码。

该阶段不与 v1 同时做，避免迁移风险集中。

## 9. 数据权限查询规则

### 9.1 获取用户可访问医院

伪代码：

```ts
async function getAccessibleHospitalIds(userId: number) {
  if (isSystemAdmin(userId) || hasGlobalCrmAdminRole(userId)) {
    return null; // null 表示不限制医院
  }

  const rows = await prisma.crmHospitalAccount.findMany({
    where: {
      userId,
      status: 1,
      deletedAt: null,
      hospital: { deletedAt: null, status: 1 },
    },
    select: { hospitalId: true },
  });

  return rows.map((item) => item.hospitalId);
}
```

### 9.2 派单列表

非全局管理员：

```ts
where.hospitalId = { in: accessibleHospitalIds }
```

如果 `accessibleHospitalIds` 为空，返回空列表。

### 9.3 派单详情

非全局管理员：

- 派单不存在：返回不存在。
- 派单医院不在可访问医院列表：返回不存在或无权访问。

## 10. 与系统角色的关系

推荐保留全局角色：

| 全局角色 | 用途 |
| --- | --- |
| 系统管理员 | 系统全量管理 |
| CRM 管理员 | 管理 CRM 全量数据 |
| 医院账号 | 登录后台并访问医院侧能力 |

医院内 `owner/admin/member` 不进入 `SysRole`。

原因：

- `SysRole` 是平台权限，不适合表达“在某一家医院里是什么身份”。
- 同一个用户可能在 A 医院是负责人，在 B 医院只是普通账号。
- 如果把医院内身份做成全局角色，会无法表达多医院差异。

## 11. 审计与安全

必须记录：

- 谁创建了医院账号关系。
- 谁修改了医院内角色。
- 谁停用或解除分配。
- 账号是否仍为全局启用状态。

安全规则：

- 不能解除最后一个 `owner`，除非操作者是系统管理员或 CRM 管理员。
- 不能把自己从最后一个 `owner` 降级，除非已有另一个启用 owner。
- 停用医院关系不等于停用系统账号。
- 删除医院时，医院账号关系随医院软删除或级联失效。
- 删除系统用户时，医院账号关系随用户失效。

## 12. 测试方案

### 12.1 API 测试

覆盖场景：

- 创建医院不需要账号。
- 新建账号并分配给医院。
- 分配已有账号给医院。
- 一个医院有多个账号。
- 一个账号属于多个医院。
- 设置医院负责人、管理员、普通账号。
- 停用医院账号关系后不可访问医院派单。
- 解除分配后不删除系统用户。
- 非系统管理员只能看到关联医院派单。
- CRM 管理员能看到全部医院派单。

### 12.2 数据迁移测试

覆盖场景：

- 历史 `accountUserId` 能回填为 `role=owner`。
- 重复执行迁移不产生重复关系。
- `accountUserId` 为空的医院不产生关系。

### 12.3 Admin 测试

覆盖场景：

- 医院编辑不显示“绑定用户ID”。
- 医院列表显示账号数和负责人。
- 账号管理可以新建账号并分配。
- 账号管理可以分配已有用户。
- 设置医院内角色后列表刷新正确。
- 停用和解除分配有二次确认。

### 12.4 回归命令

```bash
pnpm --filter yishan-api db:generate
pnpm --filter yishan-api build:ts
pnpm --filter yishan-api test
pnpm --filter yishan-admin lint
```

## 13. 分阶段落地

### 阶段一：数据模型与兼容层

- 新增 `CrmHospitalAccount`。
- 回填历史 `accountUserId`。
- 增加服务方法读取用户可访问医院。
- 保持旧字段不删除。

### 阶段二：API 与权限切换

- 新增医院账号管理接口。
- 派单权限改用医院账号关系。
- 医院 CRUD 移除 `accountUserId` 写入。

### 阶段三：管理端交互

- 医院列表增加账号管理。
- 医院编辑移除绑定用户 ID。
- 新增账号管理抽屉。

### 阶段四：清理旧模型

- 确认线上无代码读取 `accountUserId`。
- 移除旧字段和旧关系。
- 清理兼容逻辑。

## 14. 最终结论

最终方案不是“增加一套医院用户系统”，也不是立刻建设全局组织管理。

正确边界是：

```text
系统基座负责：账号、登录、全局角色、全局权限。
CRM 负责：医院、医院账号关系、医院范围内身份、医院数据权限。
```

这样既能解决当前“医院账号分配不优雅”的问题，也能自然支持未来多账号、多医院、医院管理员等扩展。
