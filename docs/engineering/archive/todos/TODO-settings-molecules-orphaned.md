# TODO: 三个设置分子失去调用方

> 父文档：[TODO.md](../../../../TODO.md) · 状态：已决策并归档（删除）

## 背景

`mine` / `security` 迁到共享 `ManagementList` / `ManagementCell` / `ActionSheet` 之后，
`apps/demo/app/src/components/molecules/` 下的三个设置组件调用方归零：

- `SettingCell`
- `SettingGroup`
- `DangerAction`

它们仍从 `src/components/molecules/index.ts` 再导出（值导出与类型导出各一组），处于
「还导出着、但没人用」的状态。原 TODO 的分歧点是：仓库是 monorepo，但没有证据表明仓库外
存在消费这个 barrel 的产品 —— 与 CLAUDE.md「`packages/core/*` 是公开面，`apps/demo/**` 是产品」
的边界一致，`apps/demo` 的内部 barrel 不构成对外契约。

## 决策

**删除**。三个目录与 barrel 里的 6 行导出（3 个值导出 + 3 个类型导出）一并移除；barrel 剩余
8 个分子不受影响。

## 验收

- `git grep` 确认删除后无残留引用（源码、测试、脚本均无）。
- `pnpm --filter @yishan/demo-app test` / `lint` 通过。

## 连带结论

legacy 的 `components/icons/LineIcon` 原本只剩这两个组件当消费者（StatCard 走同一 barrel 但导入的是
`IconFont`）。删除后它**零调用方**，见 [TODO.md 的「两套 `LineIcon` 词汇未统一」](../../../../TODO.md)
—— 那条记录已同步改写，不再把「消费者本身待删」当作前提。

## 决策人 / 时间

用户决策，2026-10-20。
