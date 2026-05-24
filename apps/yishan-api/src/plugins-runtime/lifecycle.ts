import { PluginLifecycleState } from './types'
import { PluginRegistry } from './registry'

const ALLOWED_TRANSITIONS: Record<PluginLifecycleState, PluginLifecycleState[]> = {
  discovered: ['loaded', 'error'],
  loaded: ['enabled', 'disabled', 'unloaded', 'error'],
  enabled: ['disabled', 'unloaded', 'error'],
  disabled: ['enabled', 'unloaded', 'error'],
  unloaded: ['loaded', 'error'],
  error: ['loaded', 'unloaded']
}

export class PluginLifecycle {
  constructor(private readonly registry: PluginRegistry) {}

  canTransition(from: PluginLifecycleState, to: PluginLifecycleState): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to)
  }

  transition(name: string, to: PluginLifecycleState, error?: string): void {
    const current = this.registry.get(name)
    if (!current) {
      throw new Error(`plugin not found: ${name}`)
    }

    if (!this.canTransition(current.state, to)) {
      throw new Error(`invalid lifecycle transition for plugin ${name}: ${current.state} -> ${to}`)
    }

    this.registry.updateState(name, to, error)
  }

  load(name: string): void {
    this.transition(name, 'loaded')
  }

  enable(name: string): void {
    this.transition(name, 'enabled')
  }

  disable(name: string): void {
    this.transition(name, 'disabled')
  }

  unload(name: string): void {
    this.transition(name, 'unloaded')
  }
}
