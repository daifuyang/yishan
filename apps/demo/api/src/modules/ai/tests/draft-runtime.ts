import { it as baseIt } from 'vitest'
import { AiCapabilityCatalog } from '@yishan/core-api'
import { runWithAiCapabilities } from '@yishan/core-api/ai-capabilities/catalog'
import { testRuntime } from '../../../../test/runtime-fixture.js'
import { systemAiCapabilities } from '@yishan/core-system-api'

/** Draft adapters belong to an explicitly composed application catalog. */
function scoped(original: typeof baseIt): typeof baseIt { return new Proxy(original, {
  apply(target, receiver, args) {
    const callback = args[1] as (...values: unknown[]) => unknown
    if (typeof callback === 'function') args[1] = (...values: unknown[]) => {
      const catalog = new AiCapabilityCatalog()
      catalog.register(...systemAiCapabilities)
      return testRuntime().run(() => runWithAiCapabilities(catalog, () => callback(...values)))
    }
    return Reflect.apply(target, receiver, args)
  },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver)
    if (typeof value !== 'function') return value
    if (property === 'each' || property === 'for') return (...args: unknown[]) => scoped(Reflect.apply(value, target, args))
    return scoped(value)
  },
}) }
export const it = scoped(baseIt)
