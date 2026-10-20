/**
 * ai-capabilities/catalog.ts — AI 能力注册中心的作用域门面。
 *
 * 与 `permissions/catalog.ts` 同构：门面自身**不持有任何能力定义**，
 * 所有操作都读显式的应用作用域。因此「不在运行时里就调不到能力」——
 * 和权限目录一个道理，避免模块在装配期偷跑到未初始化的状态。
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { AiCapabilityCatalog, isModelInvocableRiskLevel, type AiCapability } from '../ai-capability-catalog'

export type { AiCapability, AiCapabilityContext, AiCapabilityResult, AiRiskLevel } from '../ai-capability-catalog'
export type { AiDraftAdapter, AiDraftForm, AiDraftSubject, AiDraftQuestion } from '../ai-capability-catalog'
export { isModelInvocableRiskLevel } from '../ai-capability-catalog'

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

/**
 * 目录内**模型可调用**的能力。与 `listAiCapabilitiesFor` 同一道闸门：
 * 这个门面没有权限参数，但它仍是「交给模型」的那一侧，因此不返回
 * write/sensitive——否则将来某个调用方拿它拼工具定义就能绕过 listFor。
 * 需要权限裁剪请用 `listAiCapabilitiesFor`。
 */
export const listAiCapabilities = (): readonly AiCapability[] =>
  currentAiCapabilityCatalog().listCapabilities().filter(capability => isModelInvocableRiskLevel(capability.riskLevel))

export const getAiCapability = (name: string): AiCapability | undefined =>
  currentAiCapabilityCatalog().get(name)

/** 给当前用户可见的能力清单。仅用于裁剪发给模型的工具定义，不是授权。 */
export const listAiCapabilitiesFor = (permissions: ReadonlySet<string>): readonly AiCapability[] =>
  currentAiCapabilityCatalog().listFor(permissions)
