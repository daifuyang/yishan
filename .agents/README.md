# Yishan Agent Skills（superpowers 工作流）

> 目录约定：DSH harness 自动发现 `<repo>/.agents/skills/<skill-name>/SKILL.md`。
> 14 个 skills 与 `daifuyang/iximei-kf` 仓库的 superpowers 套件同源（同 fork），覆盖**写前脑暴 → 写 plan → 执行 → 验证 → 收尾**的完整开发循环。
> 入仓库：所有 skills 跟随代码一起 review / versioned，避免"换个机器就找不到 skills"。

## 何时用哪个 skill

| Skill | 何时触发 |
| --- | --- |
| `using-superpowers` | **任何对话开场** —— 默认必读。规则：哪怕 1% 可能用到的 skill 都必须 invoke。 |
| `brainstorming` | 创建新功能 / 加组件 / 加业务 / 改行为 之前 —— 先澄清意图和需求，避免直接动手。 |
| `writing-plans` | 有 spec 或多步任务需求时 —— 在动代码前生成 bite-sized 任务计划。 |
| `executing-plans` | 有写好的实现 plan 时 —— 按 task-by-task 执行 + review checkpoint。 |
| `test-driven-development` | 任何功能实现或 bugfix 时 —— 红 → 绿 → 重构，**先写失败测试**。 |
| `systematic-debugging` | 遇到 bug / 测试失败 / 异常行为时 —— 先定位根因再提议修法。 |
| `verification-before-completion` | 任何"完成了 / 修好了 / 跑通了"的断言前 —— 必须**跑命令看输出**，不可凭印象。 |
| `writing-skills` | 创建 / 编辑 / 验证 skill 时 —— TDD 思路应用于文档：先写压力测试 → 看 agent 失败 → 写 skill → 看通过 → 重构。 |
| `using-git-worktrees` | 启动需要隔离工作区的 feature / 执行 plan 前 —— 用 git worktree 或 harness 工具。 |
| `dispatching-parallel-agents` | 2+ 独立任务可并行时（无共享状态、无顺序依赖）。 |
| `subagent-driven-development` | 在当前会话里执行 plan（区别于 `executing-plans` 的独立 session）。 |
| `requesting-code-review` | 完成任务 / 实现主要功能 / 合并前 —— 验证工作满足要求。 |
| `receiving-code-review` | 收到 code review 反馈时 —— 验证技术合理性，不要表演性认同。 |
| `finishing-a-development-branch` | 实现完成 + 测试全绿 —— 决定如何集成（merge / PR / 留 branch）。 |

## 工作流（典型顺序）

```
brainstorming          → 澄清需求边界
  ↓
writing-plans          → 把 spec 拆成可独立 review 的 bite-sized 任务
  ↓
using-git-worktrees    → 隔离工作区
  ↓
test-driven-development + systematic-debugging → 红绿循环写代码
  ↓
verification-before-completion → 跑命令拿输出断言
  ↓
requesting-code-review → 邀请 review
  ↓
receiving-code-review  → 处理反馈
  ↓
finishing-a-development-branch → 决定 merge / PR
```

## 与本仓库现有工作流的关系

- **Speckit**：仓库已有 `.opencode/commands/speckit.*.md`（spec / plan / tasks / implement）。**不替换它**，而是互补：
  - Speckit 擅长**结构化产出三份文档**（spec.md / plan.md / tasks.md）
  - Superpowers skills 擅长**流程纪律**（TDD / 红绿 / 先脑暴 / 先 verify 后断言）
  - 实操推荐：脑暴 → 写 spec（用 Speckit 模板）→ 写 plan（用 writing-plans skill，输出符合 Speckit 模板）→ 执行（用 test-driven-development + executing-plans）→ 验证
- **CLAUDE.md** 是 standing orders（永驻上下文），不替换它；skills 是按需加载的工作流指南。

## 添加 / 修改 Skill

- 不要直接编辑已有 SKILL.md 的核心结构 —— 用 `writing-skills` skill 走 TDD 流程（先写压力测试 → 看 agent 不读 skill 时会犯的错 → 写 skill → 看 agent 读了之后变对 → 重构）
- 新增 skill：`mkdir .agents/skills/<skill-name>/ && touch .agents/skills/<skill-name>/SKILL.md`，写入 frontmatter `name` + `description`，然后调用 `writing-skills` 跑流程

## 参考

- iximei-kf 同源套件：`/home/ubuntu/workspace/products/iximei-kf/.agents/skills/`
- DSH harness skills 规范：`/home/ubuntu/workspace/infra/deepseek-harness/docs/AGENTS.md`（`.agents/skills/` 章节）
