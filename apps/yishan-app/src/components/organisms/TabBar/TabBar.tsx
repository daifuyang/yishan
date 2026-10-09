export interface TabBarItem {
  pagePath: string
  text: string
  icon: string
}

export interface TabBarProps {
  currentPath?: string
  list?: TabBarItem[]
}

/** Existing pages rely on this import; app.config owns the native tab bar. */
export function TabBar(_props: TabBarProps) {
  return null
}

export default TabBar
