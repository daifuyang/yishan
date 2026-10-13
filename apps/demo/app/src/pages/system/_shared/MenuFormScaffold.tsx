import Taro, { useRouter } from '@tarojs/taro'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import { FormContent, FormError, FormSubmitBar, ManagementPage, ManagementPageHeader } from '@/components/management'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage } from './AdminUI'

/**
 * 菜单表单与工作台菜单表单共用的加载/保存流程和页面外壳。
 *
 * 两张表单的字段不同，但「编辑时拉详情 + 同时拉一棵树做上级选项、
 * 树拉不到不阻断保存、会话切换后丢弃结果、保存成功返回上一页」
 * 必须完全一致，所以只把字段留给页面。
 */

export interface MenuFormOptions<V, T, S> {
  /** 资源名，如「菜单」「工作台菜单」：用于标题 */
  noun: string
  moduleId: string
  /** 权限前缀，如 system:menu */
  permission: string
  draft: (parentId?: number) => V
  fetch: (id: number) => Promise<T>
  toValues: (detail: T) => V
  /** 上级选项来源；拉不到不阻断保存 —— 新建顶级节点本身不依赖这棵树 */
  fetchTree: () => Promise<T[]>
  payload: (values: V, tree: T[]) => S
  create: (payload: S) => Promise<unknown>
  update: (id: number, payload: S) => Promise<unknown>
}

export function useMenuForm<V, T, S>({
  noun,
  moduleId,
  permission,
  draft,
  fetch,
  toValues,
  fetchTree,
  payload,
  create,
  update,
}: MenuFormOptions<V, T, S>) {
  const guard = useRequireAuth({ moduleId })
  const params = useRouter().params
  const rawId = params.id
  const rawParentId = params.parentId
  const id = rawId ? Number(rawId) : undefined
  const parentId = rawParentId ? Number(rawParentId) : undefined
  const required = `${permission}:${rawId ? 'update' : 'create'}`
  const canSave = useCanWrite(required)
  const [values, setValues] = useState<V>(() => draft(parentId))
  const [tree, setTree] = useState<T[]>([])
  const [loading, setLoading] = useState(Boolean(rawId))
  const [loaded, setLoaded] = useState(!rawId)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()
  const set = (patch: Partial<V>) => setValues((current) => ({ ...current, ...patch }))
  const title = rawId ? `编辑${noun}` : `新建${noun}`

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') void Taro.setNavigationBarTitle({ title })
  }, [title])

  useEffect(() => {
    mounted.current = true
    let current = true
    const alive = () => current && active()
    setLoading(Boolean(rawId))
    setLoaded(!rawId)
    setError('')
    const detail = rawId
      ? fetch(Number(rawId))
          .then((data) => {
            if (!alive()) return
            setValues(toValues(data))
            setLoaded(true)
          })
          .catch((cause) => {
            if (alive()) setError(errorMessage(cause))
          })
      : Promise.resolve()
    const options = fetchTree()
      .then((nodes) => {
        if (alive()) setTree(nodes)
      })
      .catch(() => {
        if (alive()) setTree([])
      })
    void Promise.all([detail, options]).finally(() => {
      if (alive()) setLoading(false)
    })
    return () => {
      current = false
      mounted.current = false
    }
  }, [rawId, retryCount, session])

  const disabled = !canSave || busy || loading || !loaded

  async function save() {
    if (disabled || locked.current || !active() || !canWriteModuleNow(moduleId, [required])) return
    let body: S
    try {
      body = payload(values, tree)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      if (id) await update(id, body)
      else await create(body)
      if (active() && canWriteModuleNow(moduleId, [required])) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  return {
    ready: guard.ready && guard.allowed,
    title,
    id,
    values,
    set,
    tree,
    disabled,
    loading,
    loaded,
    error,
    submitError,
    busy,
    canSave,
    save,
    retry: () => setRetryCount((value) => value + 1),
  }
}

export interface MenuFormScaffoldProps {
  form: {
    ready: boolean
    title: string
    error: string
    loading: boolean
    retry: () => void
    submitError: string
    canSave: boolean
    loaded: boolean
    busy: boolean
    save: () => Promise<void>
  }
  children: ReactNode
}

export function MenuFormScaffold({ form, children }: MenuFormScaffoldProps) {
  if (!form.ready) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title={form.title} /> : null}
      <StateView
        kind={form.error ? 'error' : form.loading ? 'loading' : 'ready'}
        text={form.error || undefined}
        onRetry={form.retry}
      >
        <FormContent>
          {children}
          <FormError>{form.submitError}</FormError>
        </FormContent>
        {form.canSave && form.loaded ? (
          <FormSubmitBar text="保存" submitting={form.busy} onSubmit={() => void form.save()} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}
