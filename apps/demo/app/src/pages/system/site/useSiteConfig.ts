import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { emptySiteConfig, getSiteConfig, type SiteConfig, updateSiteConfig } from '@/api/admin/site'
import { getSessionVersion } from '@/api/client'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage } from '../_shared/AdminUI'
import { pickFields, type SiteField } from './model'

const MODULE_ID = 'system-site'
const UPDATE = 'system:option:update'

export interface UseSiteConfigOptions {
  /**
   * 页面重新可见时重新拉取。只给概览页用：编辑页里选图片等原生操作也会触发
   * onShow，重新拉取会把用户尚未保存的输入冲掉。
   */
  refreshOnShow?: boolean
}

/** 站点配置各页面共用的加载 / 保存流程：权限守卫、会话失效保护、防重复提交。 */
export function useSiteConfig({ refreshOnShow = false }: UseSiteConfigOptions = {}) {
  const guard = useRequireAuth({ moduleId: MODULE_ID })
  const canUpdate = useCanWrite(UPDATE)
  const [config, setConfig] = useState<SiteConfig>(emptySiteConfig)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const locked = useRef(false)
  const mounted = useRef(true)
  const hidden = useRef(false)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()

  useEffect(() => {
    mounted.current = true
    if (!guard.ready || !guard.allowed) return
    let current = true
    setLoading(true)
    setError('')
    getSiteConfig()
      .then((data) => {
        if (!current || !active()) return
        setConfig(data)
        setLoaded(true)
      })
      .catch((reason) => {
        if (current && active()) setError(errorMessage(reason))
      })
      .finally(() => {
        if (current && active()) setLoading(false)
      })
    return () => {
      current = false
      mounted.current = false
    }
  }, [guard.ready, guard.allowed, revision])

  useDidHide(() => {
    hidden.current = true
  })
  useDidShow(() => {
    if (!refreshOnShow || !hidden.current) return
    hidden.current = false
    setRevision((value) => value + 1)
  })

  const setField = (field: SiteField, value: string) =>
    setConfig((previous) => ({ ...previous, [field]: value }))

  /** 只提交本页负责的字段；成功后提示并返回概览。 */
  async function save(fields: readonly SiteField[], validate?: (config: SiteConfig) => string) {
    if (!canUpdate || !loaded || locked.current || !active() || !canWriteModuleNow(MODULE_ID, [UPDATE]))
      return
    const invalid = validate?.(config)
    if (invalid) {
      setSubmitError(invalid)
      return
    }
    locked.current = true
    setSaving(true)
    setSubmitError('')
    try {
      await updateSiteConfig(pickFields(config, fields))
      if (active() && canWriteModuleNow(MODULE_ID, [UPDATE])) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (reason) {
      if (active()) setSubmitError(errorMessage(reason))
    } finally {
      locked.current = false
      if (active()) setSaving(false)
    }
  }

  return {
    guard,
    canUpdate,
    config,
    setField,
    loading,
    loaded,
    error,
    retry: () => setRevision((value) => value + 1),
    saving,
    submitError,
    setSubmitError,
    save,
    /** 表单是否可编辑：无权限、未加载完成或保存中都锁定 */
    disabled: !canUpdate || !loaded || saving,
  }
}
