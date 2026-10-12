import { MAX_HOME_APPS } from '@/modules/registry'

/** 勾选追加到末尾、取消原位移除；已满时不再追加 */
export function togglePin(ids: readonly number[], id: number, max = MAX_HOME_APPS): number[] {
  if (ids.includes(id)) return ids.filter((current) => current !== id)
  return ids.length >= max ? [...ids] : [...ids, id]
}

/** 与相邻项交换；越界时保持原样 */
export function movePin(ids: readonly number[], index: number, delta: -1 | 1): number[] {
  const target = index + delta
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return [...ids]
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
