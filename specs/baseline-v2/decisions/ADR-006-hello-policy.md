# ADR-006：hello 插件在 core profile 中的归属

- 状态：Proposed（阶段 A 起生效）
- 日期：2026-07-19
- 影响：`profiles/core.yaml`、`packages/plugin-sdk` 自检、`pnpm verify --profile core` smoke 行为、AGENTS.md 命令说明

## Context

main 分支唯一的插件就是 hello（INVENTORY §2.1）。它的语义介于"业务示例"与"SDK 自检样本"之间。方案 §2.1 明确：

- `hello` 是 SDK/样例，不参与生产默认 profile；
- main 默认使用 `core` profile；
- 但同时方案 §10 验收要求 `pnpm verify --profile core` 干净环境通过。

如果把 hello 完全移出 core profile，CI 缺少 smoke fixture；如果保留 hello 在 core profile，又违反"hello 不参与生产默认 profile"。

## Decision

1. **hello 仍存在于 `plugins/yishan/hello/plugin.ts`**，但 `manifest.kind = 'sample'`，与 `kind = 'production'` 区分。
2. **`profiles/core.yaml` 默认包含 hello**：`samples: [yishan/hello]` 是 schema 显式字段；profiles parser 把 sample plugin 编入 catalog 但打 `kind: sample` 标记。
3. **`pnpm verify --profile core` 包含 hello 的 smoke 测试**：因为 hello 是 SDK 契约的最小可执行示例（一个 GET 接口 + 一个菜单项），能挡掉"SDK 包编译失败但 CI 没发现"这类回归。
4. **生产 profile 默认排除 hello**：客户项目 `profiles/<project>.yaml` 不写 `samples:` 字段即不加载 hello；`profiles/official.yaml`（all 分支）显式 `samples: []`。
5. **`release:build --profile core` 仍然把 hello 编进 artifact**，但 release manifest 标注 `kind: sample`；客户项目 release 时如果 profile 含 sample，发布前 confirm 提示"包含 SDK sample 插件"。

## Consequences

正向：

- core profile 不至于完全没有 plugin 验证 SDK 链路。
- 客户项目有显式 opt-in 路径，而不是默认被 hello 侵染。
- sample 与 production 的区分让"hello 是否应该在生产 profile"成为可表达的设计决策，而不是约定俗成。

负向 / 风险：

- `manifest.kind` 是新字段，方案 §2.3 没列；需要在 SDK 类型上额外定义；不是破坏性变更，但下游第三方插件需明确选 kind。
- `samples:` 字段让 profile 解析器多一条 schema 路径，阶段 B 同步落地。

## 验收

- `cat profiles/core.yaml` 含 `samples: [yishan/hello]`；
- `pnpm plugins:catalog --profile core` 输出 hello 且 `kind: sample`；
- `pnpm plugins:catalog --profile official` 不输出 hello；
- 客户项目 profile（不存在 `samples:` 字段）的 catalog 不含 hello；
- 故意把 hello 的 plugin.ts 改坏，`pnpm verify --profile core` 失败，提示"sample plugin yishan/hello 装载失败"。