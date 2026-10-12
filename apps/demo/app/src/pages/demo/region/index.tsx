import { PageContainer } from '@/components/layout'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import { type DemoRegion, getRegionPath, getRegionTree, listRegions } from '@/api/demo'
import { getSessionVersion } from '@/api/client'
import {
  DetailContent,
  DetailRow,
  FormField,
  FormSection,
  formatRegionPath,
  ManagementPage,
  ManagementPageHeader,
  RegionPicker,
  type RegionPickerMode,
} from '@/components/management'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { errorMessage, withAccountScope } from '../../system/_shared/AdminUI'
import styles from './index.module.scss'

const EMPTY = '—'
const loadChildren = (parent: DemoRegion | null) => listRegions(parent ? parent.code : 0)
const loadTree = () => getRegionTree()

function RegionExample({ title, mode }: { title: string; mode: RegionPickerMode }) {
  const canPath = useCanWrite('region:path')
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState<DemoRegion[]>([])
  const [path, setPath] = useState<DemoRegion[]>([])
  const mounted = useRef(true)
  // 连续改选时只有最后一次的回填路径能落地
  const generation = useRef(0)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current++
    }
  }, [])
  async function confirm(next: DemoRegion[]) {
    setOpen(false)
    setSelection(next)
    setPath([])
    const current = ++generation.current
    const last = next[next.length - 1]
    if (!canPath || !last) return
    const session = getSessionVersion()
    const active = () =>
      mounted.current && current === generation.current && session === getSessionVersion()
    try {
      const result = await getRegionPath(last.code)
      if (active()) setPath(result)
    } catch (cause) {
      if (active()) void Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    }
  }
  const last = selection[selection.length - 1]
  const summary = formatRegionPath(selection)
  return (
    <>
      <FormSection title={title}>
      <FormField label="所在地区" arrow onArrowClick={() => setOpen(true)}>
        <View className={styles.value} onClick={() => setOpen(true)} aria-label="选择所在地区">
          <Text className={summary ? undefined : styles.placeholder}>{summary || '请选择'}</Text>
        </View>
      </FormField>
      <DetailRow label="末级代码" value={last ? last.code : EMPTY} />
      <DetailRow label="末级名称" value={last ? last.name : EMPTY} />
      <DetailRow label="回填路径" value={formatRegionPath(path) || EMPTY} />
      </FormSection>
      {/* 面板是 fixed 浮层，放在分组外，避免影响分组内末行的分割线 */}
      <RegionPicker<DemoRegion>
        open={open}
        mode={mode}
        value={selection}
        loadChildren={loadChildren}
        loadTree={loadTree}
        onConfirm={(next) => void confirm(next)}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

function RegionExamplePage() {
  const guard = useRequireAuth({ moduleId: 'demo-region' })
  const canList = useCanWrite('region:list')
  const canTree = useCanWrite('region:tree')
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>
  return (
    <ManagementPage>
      <ManagementPageHeader title="省市级联" />
      <View className={styles.content}>
        <DetailContent>
          {canList ? <RegionExample title="按需加载" mode="lazy" /> : null}
          {canTree ? <RegionExample title="整树加载" mode="tree" /> : null}
        </DetailContent>
      </View>
    </ManagementPage>
  )
}

export default withAccountScope(RegionExamplePage)
