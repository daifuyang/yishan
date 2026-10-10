# Restish 功能断点测试用例

## 目的

使用仓库已配置的 `yishan` Restish profile，对本地 API 的健康状态、鉴权、OpenAPI 契约、admin 基础能力和 CRM 只读能力做一轮无写入验证。

前置条件：

- API 运行在 `http://127.0.0.1:3100`。
- 本机已配置 `restish yishan` 及 bearer credential。
- 不在文档、日志或命令输出中记录 token。

## 用例

| ID | Restish 请求 | 预期 | 当前结果 |
|---|---|---|---|
| R01 | `restish yishan health-check` | `success=true` 且数据库 `db.ok=true` | 通过 |
| R02 | `restish yishan auth-get-current-user` | 返回当前用户和角色 | 通过 |
| R03 | `restish yishan get-user-list --page 1 --page-size 5` | 返回分页用户列表 | 通过 |
| R04 | `restish yishan get-dept-list --page 1 --page-size 5` | 返回分页部门列表 | 通过 |
| R05 | `restish yishan get-role-list --page 1 --page-size 5` | 返回分页角色列表 | 通过 |
| R06 | `restish yishan get-menu-list --page 1 --page-size 5` | 返回分页菜单列表 | 通过 |
| R07 | `restish yishan get-menu-tree` / `get-authorized-menu-tree` | 返回菜单树 | 通过 |
| R08 | `restish yishan get-dict-type-list` / `get-dict-data-list` / `get-dict-data-map` | 返回字典数据 | 通过 |
| R09 | `restish yishan get-system-region-list` | 返回地区列表 | 通过；该端点不支持分页参数 |
| R10 | `restish yishan demo-info` | 返回 demo 插件健康信息 | 通过 |
| R11 | `restish yishan get-permission-catalog` | Restish 命令可按 OpenAPI 声明调用 | 失败：服务端要求 `source`，但 OpenAPI 未声明该参数，生成命令也无法传入 |
| R12 | `restish yishan me-list-available-scopes` | 返回符合 OpenAPI schema 的授权范围 | 失败：实际 `system` 字段值不符合 `availableScopeGroup` schema |
| R13 | `restish yishan crm-customers-list --page 1 --page-size 5` | 返回 CRM 客户分页列表 | 失败：服务端数据库查询返回 `code=20001` |
| R14 | `restish yishan crm-dashboard` | 返回 CRM 工作台统计 | 失败：服务端数据库查询返回 `code=20001` |

## 当前功能断点

### P1：CRM 只读查询不可用

客户列表和工作台都能路由到服务端，但查询阶段失败。当前 Restish 观测到的是统一的 `code=20001` 和 `Failed query`，具体数据库错误没有透传，需要结合 API 进程日志或数据库 schema 进一步定位。

影响：CRM 客户页和工作台无法正常加载，是当前最直接的业务功能断点。

### P2：权限目录 OpenAPI 契约缺少 query 参数

`GET /api/v1/admin/permissions/catalog` 的实际处理器要求 `source`，但 `apps/yishan-api/openapi.json` 中该 operation 没有 parameters。Restish 生成命令因此无法正确调用该接口。

影响：OpenAPI 客户端无法发现正确调用方式，权限目录按来源筛选不可用。

### P2：API Token 可用范围响应 schema 不匹配

`me-list-available-scopes` 返回的 `system` 值无法通过 OpenAPI 的 `availableScopeGroup` schema 校验。

影响：Restish/OpenAPI 客户端在响应校验阶段失败，即使服务端已经返回业务数据。

### 低风险差异：地区列表不是分页接口

Restish 生成的地区列表命令不接受 `--page`，实际返回全量地区列表。这是当前接口设计差异，不是运行时故障。

## 复跑命令

```powershell
restish yishan health-check
restish yishan auth-get-current-user
restish yishan get-user-list --page 1 --page-size 5
restish yishan get-dept-list --page 1 --page-size 5
restish yishan get-role-list --page 1 --page-size 5
restish yishan get-menu-list --page 1 --page-size 5
restish yishan get-menu-tree
restish yishan get-authorized-menu-tree
restish yishan get-dict-type-list
restish yishan get-dict-data-list
restish yishan get-dict-data-map
restish yishan get-system-region-list
restish yishan demo-info
restish yishan get-permission-catalog
restish yishan me-list-available-scopes
restish yishan crm-customers-list --page 1 --page-size 5
restish yishan crm-dashboard
```

本记录只包含只读接口；创建、更新、删除、授权、上传等写操作需要单独准备可回滚的测试数据后再验证。
