# 用户管理测试用例清单

## 目标与执行范围

本文覆盖后台“系统管理 / 用户管理”（`/system/user`）及其 API
`/api/v1/admin/users`。移动端的“我的资料 / 修改密码 / 登录日志”列为关联
回归项，不属于后台用户 CRUD 的验收范围。

自动化用例不是替代手工验收：自动化重点验证接口契约、核心业务规则与关键 UI
链路；下面每条 `MANUAL-*` 都应由验收人员在实际环境执行并记录结果。

## 前置条件

1. 使用已 seed 的管理员帐号登录；准备一个非管理员普通用户 `U1` 和一个可删除
   的普通用户 `U2`。
2. 管理员拥有 `system:user:list/create/update/delete` 四项权限；另准备一个仅有
   `system:user:list` 权限的帐号。
3. 创建类用例使用唯一前缀 `manual-user-<日期>-<序号>`，手机号和邮箱也必须唯一。
4. 每个创建、编辑或删除用例结束后，记录用户 ID，并在环境允许时删除测试数据。

## 自动化覆盖与运行

| 测试文件 | 已覆盖内容 | 运行命令 |
| --- | --- | --- |
| `apps/yishan-api/test/admin.users.routes.test.ts` | 管理端 CRUD 路由、鉴权缺失、输入校验、管理员保护 | `pnpm --filter yishan-api exec vitest run test/admin.users.routes.test.ts` |
| `apps/yishan-api/test/user.service.test.ts` | DTO 映射、密码策略、唯一性、分页、缓存、角色权限缓存、删除、改密及令牌撤销 | `pnpm --filter yishan-api exec vitest run test/user.service.test.ts` |
| `apps/yishan-api/test/integration/user.lifecycle.test.ts` | 真实 MySQL 的用户、部门/角色关联、软删除与令牌撤销事务 | `YISHAN_RUN_INTEGRATION=1 YISHAN_TEST_MYSQL_URL='<test-db-url>' pnpm --filter yishan-api test:integration` |
| `apps/yishan-admin/e2e/modules/system.spec.ts` | 用户页渲染、关键词搜索、空结果、异常输入、创建 | `pnpm --filter yishan-admin exec playwright test e2e/modules/system.spec.ts --grep '/system/user' --reporter=list` |

运行 E2E 前，按 `apps/yishan-admin/e2e/README.md` 启动 API、Admin 并刷新登录 cookie。

## 可逐项验收的 case 清单

| ID | 场景与步骤 | 预期结果 | 自动化 |
| --- | --- | --- | --- |
| UM-LIST-01 | 打开用户管理页面 | 显示用户列表、分页及“新建”按钮；无 4xx/5xx | E2E |
| UM-LIST-02 | 搜索已知用户名 `admin` | 仅出现匹配用户名、姓名、邮箱或昵称的记录 | E2E + 手工 |
| UM-LIST-03 | 搜索不存在的唯一字符串 | 列表为 0 行，并显示空状态 | E2E |
| UM-LIST-04 | 依次搜索 `' OR '1'='1`、`admin'--`、`%zz`、`_zz`、XSS 字符串及 256 字符 | 不报错、不返回全表、页面无脚本执行 | E2E |
| UM-LIST-05 | 清空搜索后再次搜索 `admin` | 列表恢复；第二次搜索仍有效 | E2E |
| UM-LIST-06 | 分别用状态、创建时间范围、四个允许排序字段和升降序查询 | 返回数据、总数与排序均符合条件 | API/手工 |
| UM-LIST-07 | page=0、pageSize>100、非法状态/日期/排序字段 | 合法边界被规范化；非法输入返回验证错误 | Service/API |
| UM-LIST-08 | 无 `system:user:list` 权限帐号请求列表与详情 | 拒绝访问（403），不泄露用户数据 | 手工/API |
| UM-CREATE-01 | 只填手机号和合规密码，创建普通用户 | 创建成功；默认性别未知、状态启用；列表可搜索到 | Service/E2E |
| UM-CREATE-02 | 填写用户名、邮箱、姓名、昵称、生日、部门和角色 | 创建成功；详情字段与关联 ID 正确 | API/手工 |
| UM-CREATE-03 | 分别重复用户名、邮箱、手机号 | 返回“用户已存在”；数据库不产生新记录 | Service/API |
| UM-CREATE-04 | 使用少于 6 位、无数字、无字母、含 `#` 或超过 50 位的密码 | 返回密码强度业务错误/参数错误 | Service/API |
| UM-CREATE-05 | 同时传重复部门 ID、角色 ID | 关联关系去重，不产生重复关联记录 | 手工/集成 |
| UM-CREATE-06 | 无 create 权限帐号创建 | 返回 403；不产生记录 | 手工/API |
| UM-DETAIL-01 | 查看存在用户详情 | 字段完整；不包含 passwordHash、token 等敏感数据 | API/手工 |
| UM-DETAIL-02 | 查看不存在、已软删除或 id=0/非数字 | 分别为业务不存在或参数校验错误 | API |
| UM-UPDATE-01 | 仅编辑昵称 | 仅昵称改变，生日、状态、密码、部门和角色均保留 | Service/API |
| UM-UPDATE-02 | 将生日清空 | 数据库与详情中的生日被显式清空 | Service |
| UM-UPDATE-03 | 更新为本人已有的用户名/邮箱/手机号 | 可以保存；不被误判为重复 | Service |
| UM-UPDATE-04 | 更新为其他用户的用户名/邮箱/手机号 | 返回“用户已存在”，原数据不变 | Service/API |
| UM-UPDATE-05 | 更新密码后以旧密码、新密码分别登录 | 旧密码失效、新密码生效；该用户已有 token 均失效 | Service/集成 |
| UM-UPDATE-06 | 修改部门和角色 | 关联完整替换；用户详情缓存刷新；旧/新角色权限缓存失效 | Service/集成 |
| UM-UPDATE-07 | 禁用当前登录的普通用户 | 被阻止，返回用户状态错误 | API/手工 |
| UM-UPDATE-08 | 禁用 ID=1 超级管理员 | 被阻止，返回用户状态错误 | API |
| UM-UPDATE-09 | 禁用、再启用普通用户 | 两次状态切换均成功；登录行为与状态一致 | 手工/集成 |
| UM-DELETE-01 | 删除普通用户 `U2` | 返回 deleted=true；列表和详情不可见；软删除生效 | Service/API |
| UM-DELETE-02 | 删除当前登录的普通用户 | 被阻止，返回用户状态错误 | API/手工 |
| UM-DELETE-03 | 删除 ID=1 超级管理员 | 被阻止，返回用户状态错误 | API |
| UM-DELETE-04 | 删除不存在用户 | 返回用户不存在，不执行 token 撤销 | Service/API |
| UM-DELETE-05 | 删除已登录普通用户后继续使用旧 token | token 已撤销，请求被拒绝 | Service/集成 |
| UM-BATCH-01 | 勾选 2 个可删用户批量删除 | 两个请求均成功，列表刷新且选中状态清空 | 手工 |
| UM-BATCH-02 | 同时选择可删用户和超级管理员 | UI 显示成功/失败准确数量；成功项删除，受保护项保留 | 手工 |
| UM-UI-01 | 点击编辑，检查详情回填后不改密码直接保存 | 未填写密码不会覆盖原密码 | 手工 |
| UM-UI-02 | 创建/编辑时检查请求体 | 搜索传 `keyword`；用户接口仅传 `deptIds`、`roleIds` 等契约字段，不传无效字段 | E2E/浏览器 Network |
| UM-UI-03 | 创建失败、编辑失败、删除失败 | 页面展示服务端错误；列表和本地选择状态不产生错误成功提示 | 手工 |

## 已知风险与验收判定

- 2026-07-17 已修正列表搜索字段：前端“用户名”筛选会转换为 API 所需的
  `keyword`。此前 E2E 的空结果和边界搜索失败，原因是前端把 `username` 直接
  发送给接口，后端忽略该未知字段。
- 后台表单已统一为 API 契约的 `deptIds`、`roleIds`；岗位与备注字段未在用户 API
  中建模，因此不再出现在用户表单。执行 `UM-UI-02` 时仍需通过浏览器 Network
  面板确认实际请求体。
- 需要真实 MySQL 与 JWT 的 `集成` 用例不能只依赖 mock 单元测试；它们应在
  `YISHAN_RUN_INTEGRATION=1` 和独立测试库下执行，避免污染验收环境。

## 验收记录模板

| Case ID | 执行人 | 环境/构建号 | 实际结果 | 证据（截图、请求 ID） | 结论 |
| --- | --- | --- | --- | --- | --- |
| UM- |  |  |  |  | 通过 / 失败 / 阻塞 |
