import type { AiCapabilityDeclaration } from '@yishan/core-contracts'
import type { AiCapability } from '../../dist/ai-capability-catalog'

declare const capability: AiCapability
const declaration: AiCapabilityDeclaration = capability
const unsafe: AiCapabilityDeclaration = {
  ...declaration,
  // @ts-expect-error A module cannot require context fields the executor does not provide.
  execute: async (context: { databasePassword: string }) => ({ data: context.databasePassword }),
}
void unsafe
