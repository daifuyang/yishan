# Data Model: Mobile User Management for Workbench

## Entity: AdminUser

**Source**: `apps/yishan-app/src/api/admin/types.ts`

**Description**: 系统管理员用户实体

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | 用户唯一标识 |
| username | string | Yes | 用户名 |
| realName | string | No | 真实姓名 |
| nickname | string | No | 昵称 |
| phone | string | No | 手机号 |
| email | string | No | 邮箱 |
| avatar | string | No | 头像 URL |
| status | '0' \| '1' \| '2' | Yes | 状态：0=禁用，1=启用，2=锁定 |
| roleIds | number[] | No | 角色 ID 列表 |
| deptIds | number[] | No | 部门 ID 列表 |
| lastLoginTime | string | No | 最后登录时间 |
| lastLoginIp | string | No | 最后登录 IP |
| createdAt | string | Yes | 创建时间 |
| updatedAt | string | Yes | 更新时间 |
| creatorName | string | No | 创建人姓名 |
| updaterName | string | No | 更新人姓名 |
| loginCount | number | No | 登录次数 |
| genderName | string | No | 性别名称 |
| birthDate | string | No | 出生日期 |

## Entity: AdminUserListQuery

**Source**: `apps/yishan-app/src/api/admin/types.ts`

**Description**: 用户列表查询参数

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| page | number | No | 页码，默认 1 |
| pageSize | number | No | 每页条数，默认 20 |
| keyword | string | No | 搜索关键词（匹配用户名/姓名/手机号） |
| status | '0' \| '1' \| '2' | No | 状态筛选 |

## Entity: UserStatus (Enum)

**Description**: 用户状态枚举

| Value | Label | Description |
|-------|-------|-------------|
| '0' | 禁用 | 用户被禁用，无法登录 |
| '1' | 启用 | 正常用户，可以登录 |
| '2' | 锁定 | 用户被锁定 |

## Validation Rules

### 创建/更新用户

| Field | Rule |
|-------|------|
| username | 2-50 位，非空 |
| realName | 可为空 |
| password (创建时) | 6-50 位，必须含字母+数字 |
| phone | 可为空，格式校验 |
| email | 可为空，格式校验 |

### 重置密码

| Field | Rule |
|-------|------|
| newPassword | 6-50 位，必须含字母+数字 |

## State Transitions

### User Status

```
启用('1') <--> 禁用('0')
       ↓
     锁定('2')
```

锁定状态通常由系统自动触发（如连续登录失败），不通过常规操作切换。
