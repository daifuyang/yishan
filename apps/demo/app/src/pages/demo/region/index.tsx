// 组件演示，非页面样板：本页是省市区选择器的展示舞台，两组并列演示
// 按需加载和整树加载两种模式，不承担真实地址管理职责。
import { View } from '@tarojs/components'
import { PageContainer } from '@/components/layout'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { type DemoRegion, getRegionPath, getRegionTree, listRegions } from '@/api/demo'
import { getSessionVersion } from '@/api/client'
import {
  DetailContent,
  DetailRow,
  DetailSection,
  FormSection,
  formatRegionPath,
  ManagementPage,
  ManagementPageHeader,
  PickerRow,
  RegionPicker,
  type RegionPickerMode,
} from '@/components/management'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { errorMessage, withAccountScope } from '@/utils/account-scope'

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
      {/* 选区是表单里的可点击入口，结果展示读出去走详情分组 ——
         表单分组只放交互控件，详情分组只放只读行，分工不能混。 */}
      <FormSection title={title}>
        <PickerRow
          label="所在地区"
          value={summary}
          placeholder="请选择"
          arrow
          disabled={!canPath}
          onClick={() => setOpen(true)}
        />
      </FormSection>
      <DetailSection title="已选地区">
        <DetailRow label="末级代码" value={last ? last.code : EMPTY} />
        <DetailRow label="末级名称" value={last ? last.name : EMPTY} />
        <DetailRow label="回填路径" value={formatRegionPath(path) || EMPTY} />
      </DetailSection>
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
      {/* 页面没有 DetailHero，第一块白色分组需要自己补 16px 页顶距 */}
      <View style={{ paddingTop: 'var(--space-4)' }}>
        <DetailContent>
          {canList ? <RegionExample title="按需加载" mode="lazy" /> : null}
          {canTree ? <RegionExample title="整树加载" mode="tree" /> : null}
        </DetailContent>
      </View>
    </ManagementPage>
  )
}

export default withAccountScope(RegionExamplePage)
