import { ScrollView, Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'

import { StateView } from '@/components/feedback'
import { LineIcon } from './LineIcon'
import {
  isRegionLeaf,
  type RegionNode,
  regionOptionsInTree,
  regionParentKey,
  type RegionPickerMode,
  regionTabs,
  sameRegion,
  selectRegion,
} from './regionPickerLogic'
import styles from './RegionPicker.module.scss'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface RegionPickerProps<T extends RegionNode = RegionNode> {
  open: boolean
  /** 标题栏文案，默认「选择地区」 */
  title?: string
  /**
   * lazy：每一级打开时再按上级取下级（loadChildren）；
   * tree：首次打开一次性取整棵树（loadTree），之后本地展开。
   */
  mode: RegionPickerMode
  /** 当前已选路径（省 → 市 → 区），重新打开时回显 */
  value: readonly T[]
  /** 按需模式：parent 为 null 时取第一级 */
  loadChildren?: (parent: T | null) => Promise<T[]>
  /** 整树模式：返回完整的省市区树 */
  loadTree?: () => Promise<T[]>
  /** 选到末级（区县或没有下级的节点）时回传完整路径 */
  onConfirm: (path: T[]) => void
  onClose: () => void
}

type Status = 'loading' | 'error' | 'ready'

/**
 * 省 / 市 / 区底部级联选择面板。
 * 加载器由调用方注入，组件本身不依赖任何产品接口。
 */
export function RegionPicker<T extends RegionNode = RegionNode>(props: RegionPickerProps<T>) {
  // 缓存跨越多次打开保留：整树只取一次，按需模式同一上级只查一次
  const tree = useRef<T[] | null>(null)
  const cache = useRef(new Map<string, T[]>())
  const mode = useRef(props.mode)
  if (mode.current !== props.mode) {
    mode.current = props.mode
    tree.current = null
    cache.current.clear()
  }
  // 面板只在打开时挂载：每次打开都从外部值重新开始，未确认的中途选择不保留
  return props.open ? <RegionPickerPanel {...props} tree={tree} cache={cache} /> : null
}

interface PanelProps<T extends RegionNode> extends RegionPickerProps<T> {
  tree: { current: T[] | null }
  cache: { current: Map<string, T[]> }
}

function RegionPickerPanel<T extends RegionNode>({
  title = '选择地区',
  mode,
  value,
  loadChildren,
  loadTree,
  onConfirm,
  onClose,
  tree,
  cache,
}: PanelProps<T>) {
  const [draft, setDraft] = useState<T[]>(() => [...value])
  const [complete, setComplete] = useState(() => value.length > 0)
  const [active, setActive] = useState(() => Math.max(0, value.length - 1))
  const [options, setOptions] = useState<T[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const generation = useRef(0)
  // 加载器与回调走 ref：调用方传内联函数时不应触发重新请求
  const loaders = useRef({ loadChildren, loadTree, onConfirm })
  loaders.current = { loadChildren, loadTree, onConfirm }

  const parentKey = regionParentKey(draft, active)
  useEffect(() => {
    const current = ++generation.current
    const path = draft
    const depth = active
    const pathComplete = complete
    setStatus('loading')
    setError('')
    const fetchOptions = async (): Promise<T[]> => {
      if (mode === 'tree') {
        if (!tree.current) {
          if (!loaders.current.loadTree) throw new Error('未提供地区树加载器')
          tree.current = await loaders.current.loadTree()
        }
        return regionOptionsInTree(tree.current, path, depth)
      }
      const key = regionParentKey(path, depth)
      const cached = cache.current.get(key)
      if (cached) return cached
      if (!loaders.current.loadChildren) throw new Error('未提供地区加载器')
      const items = await loaders.current.loadChildren(depth === 0 ? null : path[depth - 1])
      cache.current.set(key, items)
      return items
    }
    fetchOptions()
      .then((items) => {
        if (current !== generation.current) return
        // 按需模式下，刚选的上级查回来没有下级 —— 它就是末级，直接确认
        if (!items.length && depth > 0 && depth === path.length && !pathComplete) {
          loaders.current.onConfirm(path)
          return
        }
        setOptions(items)
        setStatus('ready')
      })
      .catch((cause) => {
        if (current !== generation.current) return
        setError(cause instanceof Error ? cause.message : '地区加载失败')
        setStatus('error')
      })
    return () => {
      generation.current++
    }
  }, [active, parentKey, mode, retry])

  const choose = (node: T) => {
    const next = selectRegion(draft, active, node)
    if (isRegionLeaf(node, active, mode)) {
      onConfirm(next)
      return
    }
    setDraft(next)
    setComplete(false)
    setActive(active + 1)
  }

  const tabs = regionTabs(draft, complete)
  const selected = draft[active]
  return (
    <View className={styles.layer}>
      <View
        className={styles.mask}
        onClick={onClose}
        aria-label="取消选择"
        {...(process.env.TARO_ENV === 'h5' ? {} : { catchMove: true })}
      />
      <View className={styles.sheet}>
        <View className={styles.header}>
          <Text>{title}</Text>
          <View className={styles.close} onClick={onClose} aria-label="关闭选择">
            <LineIcon name="close" size={20} />
          </View>
        </View>
        <View className={styles.tabs}>
          {tabs.map((tab) => (
            <View
              key={tab.depth}
              className={cx(
                styles.tab,
                tab.pending && styles.tabPending,
                tab.depth === active && styles.tabActive,
              )}
              aria-label={tab.label}
              aria-selected={tab.depth === active}
              onClick={() => setActive(tab.depth)}
            >
              <Text className={styles.tab__label}>{tab.label}</Text>
            </View>
          ))}
        </View>
        <ScrollView scrollY className={styles.options}>
          <StateView
            kind={status === 'ready' ? (options.length ? 'ready' : 'empty') : status}
            text={status === 'error' ? error : status === 'ready' ? '暂无地区' : undefined}
            onRetry={() => setRetry((value) => value + 1)}
          >
            {options.map((node) => {
              const current = sameRegion(node, selected)
              return (
                <View
                  key={String(node.code)}
                  className={cx(styles.option, current && styles.selected)}
                  aria-label={node.name}
                  aria-selected={current}
                  onClick={() => choose(node)}
                >
                  <Text>{node.name}</Text>
                  {current ? <LineIcon name="check" size={18} color="var(--color-primary)" /> : null}
                </View>
              )
            })}
          </StateView>
        </ScrollView>
      </View>
    </View>
  )
}
