export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = Exclude<ThemeMode, 'system'>
export interface ThemeSnapshot {
  readonly mode: ThemeMode
  readonly resolved: ResolvedTheme
}
export interface ThemeAdapter {
  storage?: { get(): unknown; set(mode: ThemeMode): void }
  getSystemTheme?: () => ResolvedTheme
  watchSystemTheme?: (listener: (theme: ResolvedTheme) => void) => () => void
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function createThemeController(adapter: ThemeAdapter = {}) {
  let snapshot: ThemeSnapshot = { mode: 'system', resolved: 'light' }
  let system: ResolvedTheme = 'light'
  let stopWatching: (() => void) | undefined
  let consumers = 0
  let initialized = false
  const listeners = new Set<() => void>()
  function update(mode: ThemeMode) {
    const resolved = mode === 'system' ? system : mode
    if (snapshot.mode === mode && snapshot.resolved === resolved) return
    snapshot = { mode, resolved }
    listeners.forEach((listener) => listener())
  }
  function readSystem() {
    try {
      system = adapter.getSystemTheme?.() ?? 'light'
    } catch {
      system = 'light'
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setMode(mode: ThemeMode) {
      if (!isThemeMode(mode)) throw new Error('Invalid theme mode')
      initialized = true
      readSystem()
      update(mode)
      try {
        adapter.storage?.set(mode)
      } catch {
        /* A blocked cache must not block the UI. */
      }
    },
    start() {
      if (consumers++ === 0) {
        readSystem()
        let mode = snapshot.mode
        if (!initialized) {
          try {
            const saved = adapter.storage?.get()
            if (isThemeMode(saved)) mode = saved
          } catch {
            /* Storage is optional on restricted WebViews. */
          }
          initialized = true
        }
        update(mode)
        try {
          stopWatching = adapter.watchSystemTheme?.((theme) => {
            system = theme
            update(snapshot.mode)
          })
        } catch {
          /* Manual selection still works when the host cannot watch its theme. */
        }
      }
      let stopped = false
      return () => {
        if (stopped) return
        stopped = true
        if (--consumers === 0) {
          stopWatching?.()
          stopWatching = undefined
        }
      }
    },
  }
}

export type ThemeController = ReturnType<typeof createThemeController>
