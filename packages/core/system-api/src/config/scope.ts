import { currentSystemRuntime } from '../runtime'
import type { SystemConfig } from './create'

export function scopedConfig<K extends keyof SystemConfig>(key: K): SystemConfig[K] {
 return new Proxy({} as SystemConfig[K] & object, { get: (_target, property) => Reflect.get(currentSystemRuntime().config[key] as object, property), ownKeys: () => Reflect.ownKeys(currentSystemRuntime().config[key] as object), getOwnPropertyDescriptor: () => ({enumerable:true,configurable:true}) }) as SystemConfig[K]
}
