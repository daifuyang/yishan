import React from 'react'

export type ComponentLoader = () => Promise<{ default: React.ComponentType }>

/** Bind the compiler-produced registry once per consumer; never read a manifest in the browser. */
export function createComponentResolver(registry: Readonly<Record<string, ComponentLoader>>) {
  const cache = new Map<string, React.LazyExoticComponent<React.ComponentType>>()
  return (key: string | undefined): React.LazyExoticComponent<React.ComponentType> | null => {
    if (!key?.startsWith('./')) return null
    const loader = registry[key]
    if (!loader) return null
    let component = cache.get(key)
    if (!component) {
      component = React.lazy(loader)
      cache.set(key, component)
    }
    return component
  }
}
