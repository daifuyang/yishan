import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { ThemeController } from './controller'

const ThemeContext = createContext<ThemeController | null>(null)

export function ThemeProvider({
  controller,
  children,
}: {
  controller: ThemeController
  children?: ReactNode
}) {
  return <ThemeContext.Provider value={controller}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const controller = useContext(ThemeContext)
  if (!controller) throw new Error('useTheme requires ThemeProvider')
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  return { ...snapshot, setMode: controller.setMode }
}
