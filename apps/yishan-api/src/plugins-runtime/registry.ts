import { PluginLifecycleState, PluginManifest, RegisteredPlugin } from './types'

export class PluginRegistry {
  private readonly plugins = new Map<string, RegisteredPlugin>()

  register(manifest: PluginManifest, initialState: PluginLifecycleState = 'discovered'): RegisteredPlugin {
    const record: RegisteredPlugin = {
      manifest,
      state: initialState
    }
    this.plugins.set(manifest.name, record)
    return record
  }

  get(name: string): RegisteredPlugin | undefined {
    return this.plugins.get(name)
  }

  list(): RegisteredPlugin[] {
    return Array.from(this.plugins.values())
  }

  updateState(name: string, state: PluginLifecycleState, error?: string): RegisteredPlugin {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      throw new Error(`plugin not found: ${name}`)
    }

    plugin.state = state
    plugin.error = error
    return plugin
  }
}
