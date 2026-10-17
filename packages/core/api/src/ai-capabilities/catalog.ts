/**
 * ai-capabilities/catalog.ts — AI 能力注册中心的作用域门面。
 *
 * 与 `permissions/catalog.ts` 同构：门面自身**不持有任何能力定义**，
 * 所有操作都读显式的应用作用域。因此「不在运行时里就调不到能力」——
 * 和权限目录一个道理，避免模块在装配期偷跑到未初始化的状态。
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { AiCapabilityCatalog, type AiCapability } from '../ai-capability-catalog'

export type { AiCapability, AiCapabilityContext, AiCapabilityResult, AiRiskLevel } from '../ai-capability-catalog'
export { MODEL_INVOCABLE_RISK_LEVELS, isModelInvocableRiskLevel } from '../ai-capability-catalog'

const scope = new AsyncLocalStorage<AiCapabilityCatalog>()

export function runWithAiCapabilities<T>(catalog: AiCapabilityCatalog, operation: () => T): T {
  return scope.run(catalog, operation)
}

export function currentAiCapabilityCatalog(): AiCapabilityCatalog {
  const catalog = scope.getStore()
  if (!catalog) throw new Error('AI capability operation requires an application scope')
  return catalog
}

export const registerAiCapabilities = (...definitions: readonly AiCapability[]): void => {
  currentAiCapabilityCatalog().register(...definitions)
}

export const listAiCapabilities = (): readonly AiCapability[] => currentAiCapabilityCatalog().listCapabilities()

export const getAiCapability = (name: string): AiCapability | undefined =>
  currentAiCapabilityCatalog().get(name)

/** 给当前用户可见的能力清单。仅用于裁剪发给模型的工具定义，不是授权。 */
export const listAiCapabilitiesFor = (permissions: ReadonlySet<string>): readonly AiCapability[] =>
  currentAiCapabilityCatalog().listFor(permissions)
