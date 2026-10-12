import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import {
  getStorageConfig,
  saveStorageConfig,
  type StorageConfig,
  type StorageConnectionResult,
  testStorageConnection,
} from '@/api/admin/storage'
import { getSessionVersion } from '@/api/client'
import { confirmAction, useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage } from '../_shared/AdminUI'
import { providerLabel, type StorageSection, sectionPayload, validateStorage } from './model'

const MODULE_ID = 'system-storage'
const UPDATE = 'system:storage:update'

export interface UseStorageConfigOptions {
  /** 页面重新可见时重新拉取，只给概览页用：编辑页重新拉取会冲掉未保存的输入 */
  refreshOnShow?: boolean
}

/** 云存储各页面共用的加载 / 保存 / 测试连接流程：权限守卫、会话失效保护、防重复提交。 */
export function useStorageConfig({ refreshOnShow = false }: UseStorageConfigOptions = {}) {
  const guard = useRequireAuth({ moduleId: MODULE_ID })
  const canUpdate = useCanWrite(UPDATE)
  const [config, setConfig] = useState<StorageConfig>({ provider: 'disabled', qiniu: {}, aliyunOss: {} })
  /** 服务端当前生效的服务商：切换服务商会清空原服务商配置，需要据此二次确认 */
  const [savedProvider, setSavedProvider] = useState<StorageConfig['provider']>('disabled')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<StorageConnectionResult | null>(null)
  const locked = useRef(false)
  const mounted = useRef(true)
  const hidden = useRef(false)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()
  const writable = () => canUpdate && loaded && active() && canWriteModuleNow(MODULE_ID, [UPDATE])

  useEffect(() => {
    mounted.current = true
    if (!guard.ready || !guard.allowed) return
    let current = true
    setLoading(true)
    setError('')
    getStorageConfig()
      .then((data) => {
        if (!current || !active()) return
        setConfig(data)
        setSavedProvider(data.provider)
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

  /** 修改草稿：任何字段变化都让上一次测试结果失效，避免「测的是旧配置」的误读 */
  const update = (next: (previous: StorageConfig) => StorageConfig) => {
    setConfig(next)
    setTestResult(null)
  }

  async function save(section: StorageSection) {
    if (!writable() || locked.current) return
    const invalid = validateStorage(config)
    if (invalid) {
      setSubmitError(invalid)
      return
    }
    locked.current = true
    try {
      if (config.provider !== savedProvider && savedProvider !== 'disabled') {
        const disabling = config.provider === 'disabled'
        const confirmed = await confirmAction({
          title: disabling ? '关闭云存储' : `切换为${providerLabel(config.provider)}`,
          content: disabling
            ? `关闭后会清除已有的${providerLabel(savedProvider)}配置，确认继续？`
            : `保存后会清除原有的${providerLabel(savedProvider)}配置，确认继续？`,
        })
        if (!confirmed || !writable()) return
      }
      setSaving(true)
      setSubmitError('')
      await saveStorageConfig(sectionPayload(config, section))
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

  async function test() {
    if (!writable() || locked.current || config.provider === 'disabled') return
    const invalid = validateStorage(config)
    if (invalid) {
      setSubmitError(invalid)
      return
    }
    locked.current = true
    setTesting(true)
    setSubmitError('')
    setTestResult(null)
    try {
      const result = await testStorageConnection(config)
      if (active()) setTestResult(result)
    } catch (reason) {
      if (active()) setSubmitError(errorMessage(reason))
    } finally {
      locked.current = false
      if (active()) setTesting(false)
    }
  }

  return {
    guard,
    canUpdate,
    config,
    update,
    savedProvider,
    loading,
    loaded,
    error,
    retry: () => setRevision((value) => value + 1),
    saving,
    submitError,
    save,
    testing,
    testResult,
    test,
    /** 表单是否可编辑：无权限、未加载完成、保存或测试中都锁定 */
    disabled: !canUpdate || !loaded || saving || testing,
  }
}
