# AI Tool Call 展示层架构

本文描述 Admin 端「工具调用（Tool Call）卡片」的展示架构。基线：2026-10-21 重构前，
展示逻辑散落在 `AiMessageProgress.tsx` 与 `AiToolResultCard.tsx` 两套并行实现里，
按 `render.kind` 写成长 if/else 链，新增一个业务工具往往要新增一个 React 组件。

重构目标：**通用抽象组件优先、组合复用优先、专属 Renderer 最小化、未知工具可靠兜底**。

## 分层

```
message.parts (AI SDK 流式事件)
   │  tools/adapter.ts        纯函数，无 React / 无状态 / 无网络
   ▼
ToolCallViewModel[]           tools/model.ts
   │  tools/registry.ts       register(type) / resolve(type)
   ▼
Renderer                      tools/renderers/*
   │  tools/components/*      ToolCallCard / ToolHeader / ToolStatus / ToolDetails
   ▼
DOM
```

- `tools/model.ts` — 展示模型与类型（`ToolCallStatus`、`ToolPresentationType`、
  `ToolCallViewModel`）。全部为显式类型，无 `any`、无无约束断言。
- `tools/adapter.ts` — 唯一转换层。`rawToolCalls` 折叠流式 part，`toToolCalls`
  产出视图模型，`trustedRender` 是全项目**唯一**解读服务端 `render.kind` 的地方
  （展示层与「要不要自动弹表单」共用同一套 kind 语义）。
- `tools/registry.ts` — Renderer 注册表。`resolve(type)` 永远是确定性的：
  命中即返回，未命中返回默认兜底，不会因为少注册一个类型而让整条会话崩掉。
- `tools/renderers/` — 4 个通用 Renderer + 3 个工具专属 Renderer（见下）。
- `tools/components/` — 公共组件，**不依赖任何具体业务模块**。

## 三个不能合并的概念

| 概念 | 例子 | 含义 |
| --- | --- | --- |
| `toolName` | `query_business_data` | 实际执行的工具 |
| `operationId` | `user.list` | 业务操作 |
| `presentation.type` | `query` | 展示模式 |

三者不是一回事，**不能**合并成一个字段。模型的输入里写什么都不影响展示模式：
展示类型只由服务端声明的 `render.kind` 决定（`trustedRender`），
模型生成的任意字符串不得直接决定加载哪个 React 组件。

## Renderer 分级

| Renderer | 覆盖行为 |
| --- | --- |
| `GenericToolRenderer` | 兜底：可读工具名 + 状态 + 少量关键参数 + 可选结果/错误摘要。缺字段/畸形数据也必须能渲染。 |
| `QueryRenderer` | 记录数组、单个对象、空结果、异常结构四种形状；列优先取服务端声明，没有就从数据行推导（新增查询工具无需补列配置）。分页在客户端做。 |
| `FormPreviewRenderer` | 只做两件事。**草稿模式**：一行「已将提供的信息填入表单草稿」，不重复已填字段、不放表单、不放「继续填写」按钮；**预填模式**（`form.prefill`）：展示已填字段与缺失字段，提供「打开表单核对并提交」入口，交给原生表单。**只读预览，不在卡片里再造第二份表单。** |
| `ActionResultRenderer` | 跳转 / 需人工确认的动作：目标、结果、错误摘要、下一步。成功与否以**真实业务 API 响应**为准，不采信模型自述。 |
| `DescribeOperationRenderer`（工具专属） | `describe_operation` 只**读了一份操作定义**：展开区只有一句「已获取需要填写的信息及校验规则」（表单）或「已获取该操作的说明」（操作）。不出现原始 Schema JSON、工具参数、完整字段定义，不做第二层折叠。默认收起，用户手动展开后不被后续流式更新覆盖。 |
| `UpdateFormDraftRenderer`（工具专属） | `update_form_draft` 只**把信息写进了草稿**：展开区只有一句「已将提供的信息填入表单草稿」。不把整份表单塞进工具记录，不重复列出已填字段，不放「继续填写」按钮，不出现部门/头像这类业务控件。默认收起，展开状态由用户掌握。 |
| `DiscoverOperationsRenderer`（工具专属） | `discover_operations` 的结果是**一组业务能力定义**（`user.create.form` / `user.create` …），摊成表格会挤压列宽、中文逐字换行。改为**面向普通用户**的单层折叠：标题是自然中文（「查找新建用户功能」），默认收起，展开后是一列纯文字结果（`✓ 已找到用户信息填写入口`）。不出现工具名、能力 ID、内部分类、原始参数与 JSON，也没有第二层详情折叠；结果项不可点击、不可再展开。文案由业务元数据（`name` / `presentation.subject` / `presentation.kind` / `type`）推导，识别不出来时降级为「已找到：{业务中文名称}」，不按能力 ID 硬编码。按工具名注册（`registerTool`），优先级高于展示类型。 |

未注册 / 非法展示类型 → `GenericToolRenderer` 兜底，附带开发期诊断（重复注册、
非法类型），但诊断不会让渲染失败。

## 标题 / 参数 / 状态 / 输出各来自哪里

- **title**：`tools/labels.ts` 的可信本地化标题表 → 格式化后的工具名 → 按动作语义
  （discover / describe / query / draft）推导的通用标题。
- **subtitle**：服务端 `progress.subject` / 操作元数据的 `subject`，其次是入参里的
  `description` / `path`。工具的 `description`（给模型看的能力说明）不出现在界面。
- **summary**：`safeSummary` 从入参里挑出的少量安全标量；敏感键（password/token/secret…）
  走 `safe-data.ts` 的脱敏，绝不回显。
- **status**：只由真实事件驱动 —— part 的 `state` + 服务端 `ok` 标志。
  `pending / running / success / error / cancelled` 五态，状态色不是唯一区分手段
  （每个状态都有 `aria-label` 与独立图标）。
- **output**：服务端 `render.payload` / `data`，即真实执行结果，不是模型正文。
  兜底路径下的原始载荷在 `details.output` 里，仍然经过脱敏。

## 草稿与正式提交的安全边界

- AI 只负责**准备和补全**草稿；工具卡片不渲染可编辑表单，也不调用任何创建接口。
- 草稿的值以**服务端草稿**为准；工具执行成功**不等于**业务数据创建成功。
- 正式创建只发生在**用户确认之后**，且走**原有业务 API**（服务端重新鉴权、校验、
  处理重复提交）。见下节「补全面板」。

## 补全面板（独立于工具记录）

补全交互**不在工具卡片里**。`components/AiFormCompletion.tsx` 是独立面板，
挂在写下最新草稿的那条消息下面，与工具记录**共享同一份草稿**：

```text
AI 收集已知信息 → 读业务 schema → 生成草稿 → 算缺失字段
  → 一次性展示全部待补全字段 → 用户填写 → 合并 + 校验
  → 用户确认 → 原有业务 API 正式创建
```

- **缺失字段由服务端按真实表单契约算出**（`computeDraftCompletionFields`），
  规则全部来自契约：已填且合法的不再问；未填的必填与选填都问；`0`/`false` 是
  合法值；契约声明的默认值按已填处理；隐藏字段不问；已填但不合法的字段要出现
  并标记为「需要修正」。**不按字段名硬编码**。
- **表单是原生表单的过滤展示模式**：业务把自己的补全表单注册到
  `@yishan/core-admin/form-assistance` 的 `registerAiFormCompletion`，
  AI 侧只负责「把还缺的字段一次性收齐、合并进草稿、请用户确认」，
  字段长什么样、怎么校验、怎么提交全部由业务自己的表单决定。
- **敏感值只活在这次表单里**：密码、头像由受保护的原生控件持有，
  **不进草稿、不进模型上下文、不进日志**，只随这一次提交走。
- **阶段互不混淆**：工具执行中 / 已完成 / 草稿已生成 / 待补全 / 校验未过 /
  待确认 / 提交中 / 已创建 / 创建失败各是各的态；重复点击有守卫，
  同一份草稿最多完成一次创建。

## 生命周期

- 同一个 `toolCallId` 始终对应同一张卡片：状态变化只更新它，不新建卡片。
- 已确认的终态（成功 / 失败 / 拒绝）不会被迟到的输入事件或错误事件改写。
- 重复事件、乱序事件、并行工具互不覆盖；进入历史会话/刷新后按 ID 重新归并。

## 目录

```
apps/demo/admin/src/modules/ai/tools/
  model.ts          展示模型与类型
  adapter.ts        纯函数转换层（含 trustedRender）
  registry.ts       Renderer 注册表
  labels.ts         标题表、列名表、枚举标签
  safe-data.ts      脱敏与安全取值
  components/       ToolCallCard / ToolHeader / ToolStatus / ToolDetails / ToolCallList / ToolResultLine
  renderers/        Generic / Query / FormPreview / ActionResult
                    + 工具专属：DiscoverOperations / DescribeOperation / UpdateFormDraft

apps/demo/admin/src/modules/ai/components/
  AiFormCompletion.tsx   独立的草稿补全面板（不塞进工具卡片）
```

## 新增一个业务工具的默认代价

**不需要**新增 React Renderer。服务端给出 `render.kind` 后，通用组件即可组合出卡片；
只有当某个业务需要**通用组件组合不出来**的特殊展示行为时，才新增专属 Renderer。
