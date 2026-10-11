import { withAccountScope } from '../_shared/AdminUI'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { exportStorageConfig, getStorageConfig, importStorageConfig, parseStorageImport, saveStorageConfig, type StorageConfig } from '@/api/admin/storage'
import { Button } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { confirmAction, useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { AdminNotice, AdminPage, AdminSelect, errorMessage } from '../_shared/AdminUI'

const providers = [{ label: '关闭云存储', value: 'disabled' }, { label: '七牛云', value: 'qiniu' }, { label: '阿里云 OSS', value: 'aliyunOss' }]
const regions = [{ label: '华东', value: 'z0' }, { label: '华北', value: 'z1' }, { label: '华南', value: 'z2' }, { label: '北美', value: 'na0' }, { label: '东南亚', value: 'as0' }]
const qiniuFields = [['accessKey', 'AccessKey'], ['secretKey', 'SecretKey'], ['bucket', 'Bucket'], ['domain', 'CDN 域名'], ['uploadHost', '上传地址'], ['callbackUrl', '回调地址']] as const
const ossFields = [['accessKeyId', 'AccessKeyId'], ['accessKeySecret', 'AccessKeySecret'], ['bucket', 'Bucket'], ['region', '区域'], ['endpoint', 'Endpoint'], ['domain', 'CDN 域名']] as const

function StoragePage() {
  const guard = useRequireAuth({ moduleId: 'system-storage' })
  const isCurrent = useCurrentModuleAccess('system-storage')
  const canUpdate = useCanWrite('system:storage:update')
  const [config, setConfig] = useState<StorageConfig>({ provider: 'disabled', qiniu: {}, aliyunOss: {} })
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const locked = useRef(false)
  const access = useRef({ allowed: false, write: false })
  access.current = { allowed: guard.allowed, write: guard.allowed && canUpdate }
  useEffect(() => {
    if (!guard.allowed) return
    let active = true
    setLoading(true)
    setLoaded(false)
    setError('')
    getStorageConfig().then((data) => { if (active) { setConfig(data); setLoaded(true) } })
      .catch((reason) => { if (active) setError(errorMessage(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [guard.allowed, revision])
  const run = async (operation: 'save' | 'export' | 'import') => {
    const required = [operation === 'export' ? 'system:storage:list' : 'system:storage:update']
    if (!loaded || locked.current || !isCurrent(required) || !access.current.allowed || (operation !== 'export' && !access.current.write)) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      if (operation === 'export') {
        const result = await exportStorageConfig()
        if (!isCurrent(required)) return
        await Taro.setClipboardData({ data: JSON.stringify(result, null, 2) })
        if (!isCurrent(required)) return
        await Taro.showToast({ title: '配置已复制', icon: 'success' })
        return
      }
      const payload = operation === 'import' ? parseStorageImport(importText) : config
      if (payload.provider === 'qiniu' && (!payload.qiniu.accessKey?.trim() || !payload.qiniu.bucket?.trim() || !regions.some((item) => item.value === payload.qiniu.region))) throw new Error('请填写七牛云 AccessKey、Bucket 和区域')
      if (payload.provider === 'qiniu' && payload.qiniu.tokenExpires !== undefined && (!Number.isInteger(payload.qiniu.tokenExpires) || payload.qiniu.tokenExpires < 60 || payload.qiniu.tokenExpires > 86400)) throw new Error('Token 过期时间须为 60–86400 秒的整数')
      if (payload.provider === 'aliyunOss' && (!payload.aliyunOss.accessKeyId?.trim() || !payload.aliyunOss.bucket?.trim() || !payload.aliyunOss.region?.trim())) throw new Error('请填写 OSS AccessKeyId、Bucket 和区域')
      if (operation === 'import' || payload.provider === 'disabled') {
        if (!await confirmAction({ title: operation === 'import' ? '导入存储配置' : '关闭云存储', content: payload.provider === 'disabled' ? '关闭后会清除已有云存储配置，确认继续？' : '此操作将覆盖当前云存储配置，确认继续？' })) return
      }
      if (!access.current.write || !isCurrent(required)) return
      if (operation === 'import') {
        await importStorageConfig(payload)
        if (!isCurrent(required)) return
        setShowImport(false)
        setImportText('')
        setRevision((value) => value + 1)
      } else {
        const result = await saveStorageConfig(payload)
        if (!isCurrent(required)) return
        setConfig(result)
      }
      await Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (reason) { if (isCurrent()) setError(errorMessage(reason)) }
    finally { locked.current = false; if (isCurrent()) setBusy(false) }
  }
  if (!guard.ready || !guard.allowed) return <AdminPage title="云存储配置">{null}</AdminPage>
  const disabled = !canUpdate || busy
  return <AdminPage title="云存储配置">
    {loading ? <StateView kind="loading" /> : !loaded ? <StateView kind="error" text={error || '配置未加载'} onRetry={() => setRevision(revision + 1)} /> : <>
      <View className="admin-card">
        <AdminSelect label="存储服务商" value={config.provider} options={providers} disabled={disabled} onChange={(value) => { if (value === 'disabled' || value === 'qiniu' || value === 'aliyunOss') setConfig({ ...config, provider: value }) }} />
        {config.provider === 'qiniu' && <>
          {qiniuFields.map(([key, label]) => <FormField key={key} type="input" label={label} password={key === 'secretKey'} value={config.qiniu[key] || ''} hint={key === 'secretKey' ? '留空保留已有密钥；首次配置需输入密钥' : undefined} disabled={disabled} maxLength={-1} onInput={(value) => setConfig({ ...config, qiniu: { ...config.qiniu, [key]: value } })} />)}
          <AdminSelect label="区域" value={config.qiniu.region || 'z0'} options={regions} disabled={disabled} onChange={(region) => setConfig({ ...config, qiniu: { ...config.qiniu, region } })} />
          <FormField type="input" label="Token 过期时间（秒）" inputType="number" value={String(config.qiniu.tokenExpires ?? 3600)} disabled={disabled} onInput={(value) => setConfig({ ...config, qiniu: { ...config.qiniu, tokenExpires: Number(value) } })} />
          <FormField type="switch" label="HTTPS" checked={config.qiniu.useHttps ?? true} disabled={disabled} onChange={(useHttps) => setConfig({ ...config, qiniu: { ...config.qiniu, useHttps } })} />
          <FormField type="switch" label="CDN 加速" checked={config.qiniu.useCdnDomains ?? true} disabled={disabled} onChange={(useCdnDomains) => setConfig({ ...config, qiniu: { ...config.qiniu, useCdnDomains } })} />
        </>}
        {config.provider === 'aliyunOss' && <>
          {ossFields.map(([key, label]) => <FormField key={key} type="input" label={label} password={key === 'accessKeySecret'} value={config.aliyunOss[key] || ''} hint={key === 'accessKeySecret' ? '留空保留已有密钥；首次配置需输入密钥' : undefined} disabled={disabled} maxLength={-1} onInput={(value) => setConfig({ ...config, aliyunOss: { ...config.aliyunOss, [key]: value } })} />)}
          <FormField type="switch" label="HTTPS" checked={config.aliyunOss.useHttps ?? true} disabled={disabled} onChange={(useHttps) => setConfig({ ...config, aliyunOss: { ...config.aliyunOss, useHttps } })} />
        </>}
        <View className="admin-actions">{canUpdate && <Button loading={busy} onClick={() => run('save')}>保存</Button>}<Button variant="secondary" disabled={busy} onClick={() => run('export')}>复制导出配置</Button>{canUpdate && <Button variant="secondary" disabled={busy} onClick={() => setShowImport(!showImport)}>导入</Button>}</View>
      </View>
      {showImport && canUpdate && <View className="admin-card"><Text className="admin-section-title">导入配置</Text><FormField type="textarea" label="配置 JSON" value={importText} maxLength={-1} disabled={busy} onInput={setImportText} /><Button disabled={!importText.trim()} loading={busy} onClick={() => run('import')}>确认导入</Button></View>}
      {error && <AdminNotice>{error}</AdminNotice>}
    </>}
  </AdminPage>
}

export default withAccountScope(StoragePage)
