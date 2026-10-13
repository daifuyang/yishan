import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { ApplicationIcon } from '@/components/ApplicationIcon'
import {
  ActionSheet,
  type ActionSheetItem,
  Checkbox,
  DetailContent,
  DetailSection,
  FormSubmitBar,
  ManagementCell,
  ManagementFilterBar,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
} from '@/components/management'
import { getWorkbenchGroups, MAX_HOME_APPS } from '@/modules/registry'
import { withAccountScope } from '@/pages/system/_shared/AdminUI'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { movePin, togglePin } from './model'

function HomeAppsEditPage() {
  const guard = useRequireAuth()
  const menus = useModuleStore((state) => state.menus)
  const home = useModuleStore((state) => state.home)
  const loaded = useModuleStore((state) => state.loaded)
  const error = useModuleStore((state) => state.error)
  const user = useAuthStore((state) => state.user)
  const enabledModuleIds = useAuthStore((state) => state.enabledModuleIds)
  const [draft, setDraft] = useState<number[] | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const locked = useRef(false)

  const ready = guard.ready && guard.allowed
  useEffect(() => {
    if (ready) void useModuleStore.getState().load({ force: true })
  }, [ready])

  const groups = getWorkbenchGroups(menus, user?.permissions, enabledModuleIds)
  const byMenuId = new Map(groups.flatMap((group) => group.apps).map((app) => [app.menuId, app]))

  // 草稿只在首次拿到数据时初始化，之后的刷新不覆盖用户正在做的调整。
  // 依赖刻意只取 [loaded, home]：byMenuId 每次渲染都重建，放进依赖会让 effect 每轮都跑；
  // draft 由 null 守卫，初始化后不再变化。草稿里因授权变化而不可见的 id 由下方 ids 过滤
  useEffect(() => {
    if (draft === null && loaded && home) setDraft(home.pinned.filter((id) => byMenuId.has(id)))
  }, [loaded, home])

  if (!ready) return <ManagementPage>{null}</ManagementPage>

  const pinned = (draft ?? []).flatMap((id) => byMenuId.get(id) ?? [])
  // 所有操作都落在可见列表上：草稿可能残留刷新后已不可见的 id，直接对 draft 取下标或计数会错位
  const ids = pinned.map((app) => app.menuId)
  const full = ids.length >= MAX_HOME_APPS
  const searchGroups = query.trim()
    ? getWorkbenchGroups(menus, user?.permissions, enabledModuleIds, query)
    : groups
  const kind = draft !== null ? 'ready' : !loaded && !error ? 'loading' : 'error'
  const retry = () => void useModuleStore.getState().load({ force: true })

  const save = async () => {
    if (locked.current || draft === null) return
    locked.current = true
    setSaving(true)
    try {
      await useModuleStore.getState().savePins(ids)
      Taro.showToast({ title: '已保存', icon: 'success' })
      await navigateBack()
    } catch (failure) {
      Taro.showToast({
        title: failure instanceof Error ? failure.message : '保存失败，请重试',
        icon: 'none',
      })
    } finally {
      locked.current = false
      setSaving(false)
    }
  }

  const activeApp = active === null ? undefined : pinned[active]
  // ActionSheet 的选项点击不会自动关闭面板，每项执行完后手动收起
  const sheetItems: ActionSheetItem[] =
    active === null || !draft
      ? []
      : [
          ...(active > 0
            ? [
                {
                  key: 'up',
                  label: '上移',
                  onClick: () => {
                    setDraft(movePin(ids, active, -1))
                    setActive(null)
                  },
                },
              ]
            : []),
          ...(active < pinned.length - 1
            ? [
                {
                  key: 'down',
                  label: '下移',
                  onClick: () => {
                    setDraft(movePin(ids, active, 1))
                    setActive(null)
                  },
                },
              ]
            : []),
          {
            key: 'remove',
            label: '取消固定',
            danger: true,
            onClick: () => {
              if (activeApp) setDraft(togglePin(ids, activeApp.menuId))
              setActive(null)
            },
          },
        ]

  return (
    <ManagementPage withActions>
      <ManagementPageHeader title="编辑常用应用" />
      <ManagementFilterBar>
        <ManagementSearchBar value={query} onChange={setQuery} placeholder="搜索应用" />
      </ManagementFilterBar>
      <ManagementStates kind={kind} errorText={error ?? '常用应用加载失败'} onRetry={retry}>
        <DetailContent>
          <DetailSection title={`已固定 (${pinned.length}/${MAX_HOME_APPS})`}>
            {pinned.length ? (
              pinned.map((app, index) => (
                <ManagementCell
                  key={app.menuId}
                  leading={<ApplicationIcon id={app.id} icon={app.icon} />}
                  title={app.name}
                  bordered={index < pinned.length - 1}
                  showArrow={false}
                  onClick={() => setActive(index)}
                />
              ))
            ) : (
              <ManagementCell
                title="未固定的位置会按你的使用习惯自动推荐"
                bordered={false}
                showArrow={false}
              />
            )}
          </DetailSection>
          {searchGroups.map((group) => (
            <DetailSection key={group.id} title={group.name}>
              {group.apps.map((app, index) => {
                const checked = ids.includes(app.menuId)
                const disabled = !checked && full
                return (
                  <ManagementCell
                    key={app.menuId}
                    leading={<ApplicationIcon id={app.id} icon={app.icon} />}
                    title={app.name}
                    tag={<Checkbox checked={checked} disabled={disabled} />}
                    disabled={disabled}
                    bordered={index < group.apps.length - 1}
                    showArrow={false}
                    onClick={() => draft && setDraft(togglePin(ids, app.menuId))}
                  />
                )
              })}
            </DetailSection>
          ))}
          {query.trim() && searchGroups.length === 0 ? (
            <ManagementStates kind="empty" emptyText="未找到相关应用" />
          ) : null}
        </DetailContent>
      </ManagementStates>
      <ActionSheet
        open={active !== null}
        title={activeApp?.name}
        items={sheetItems}
        onClose={() => setActive(null)}
      />
      {kind === 'ready' ? (
        <FormSubmitBar text="保存" submitting={saving} onSubmit={() => void save()} />
      ) : null}
    </ManagementPage>
  )
}

export default withAccountScope(HomeAppsEditPage)
