import { withAccountScope } from '../_shared/AdminUI'
import { useEffect, useRef, useState } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { emptySiteConfig, getSiteConfig, saveSiteConfig, siteFields } from '@/api/admin/site'
import { Button } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { AdminPage, AdminNotice, errorMessage } from '../_shared/AdminUI'

function SitePage() {
  const guard = useRequireAuth({ moduleId: 'system-site' })
  const isCurrent = useCurrentModuleAccess('system-site')
  const canUpdate = useCanWrite('system:option:update')
  const [config, setConfig] = useState(emptySiteConfig)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const locked = useRef(false)
  const access = useRef(false)
  access.current = guard.allowed && canUpdate
  useEffect(() => {
    if (!guard.allowed) return
    let active = true
    setLoading(true)
    setLoaded(false)
    setError('')
    getSiteConfig().then((data) => { if (active) { setConfig(data); setLoaded(true) } })
      .catch((reason) => { if (active) setError(errorMessage(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [guard.allowed, revision])
  const save = async () => {
    if (!access.current || !isCurrent(['system:option:update']) || !loaded || locked.current) return
    if (!config.siteName.trim()) { setError('请输入站点名称'); return }
    locked.current = true
    setSaving(true)
    setError('')
    try { await saveSiteConfig(config); if (isCurrent(['system:option:update'])) await Taro.showToast({ title: '保存成功', icon: 'success' }) }
    catch (reason) { if (isCurrent()) setError(errorMessage(reason)) }
    finally { locked.current = false; if (isCurrent()) setSaving(false) }
  }
  if (!guard.ready || !guard.allowed) return <AdminPage title="站点配置">{null}</AdminPage>
  return <AdminPage title="站点配置">
    {loading ? <StateView kind="loading" /> : !loaded ? <StateView kind="error" text={error || '站点配置未加载'} onRetry={() => setRevision(revision + 1)} /> : <View className="admin-card">
      {siteFields.map(([key, label]) => key === 'seoDescription' || key === 'footerHtml' ?
        <FormField key={key} type="textarea" label={label} value={config[key]} disabled={!canUpdate || saving} maxLength={-1} onInput={(value) => setConfig({ ...config, [key]: value })} /> :
        <FormField key={key} type="input" label={label} required={key === 'siteName'} value={config[key]} disabled={!canUpdate || saving} maxLength={-1} onInput={(value) => setConfig({ ...config, [key]: value })} />)}
      {error && <AdminNotice>{error}</AdminNotice>}
      {canUpdate && <Button loading={saving} onClick={save}>保存</Button>}
    </View>}
  </AdminPage>
}

export default withAccountScope(SitePage)
