import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { Image, Text, Video, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import {
  type Attachment,
  attachmentUrl,
  deleteAttachment,
  getAttachment,
  getCloudUploadConfig,
} from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  type BottomAction,
  BottomActionBar,
  DetailContent,
  DetailRow,
  DetailSection,
  LineIcon,
  ManagementPage,
  ManagementPageHeader,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { confirmAction, useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { formatSize, KIND_GLYPH, KIND_LABELS } from '../model'
import styles from './index.module.scss'

const DELETE = 'system:attachment:delete'

function AttachmentDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const isCurrent = useCurrentModuleAccess('system-attachments')
  const id = Number(useRouter().params.id)
  const canUpdate = useCanWrite('system:attachment:update')
  const canDelete = useCanWrite(DELETE)
  const canReadOptions = useCanWrite('system:option:list')
  const [item, setItem] = useState<Attachment | null>(null)
  const [domain, setDomain] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  // 预览加载失败时回退到占位，而不是留一个破图；记录失败的地址，换链接后重新尝试
  const [failedUrl, setFailedUrl] = useState('')
  const locked = useRef(false)
  const sequence = useRef(0)
  const refreshOnShow = useRef(false)
  const audio = useRef<ReturnType<typeof Taro.createInnerAudioContext> | null>(null)

  async function load() {
    if (!guard.ready || !guard.allowed) return
    const current = ++sequence.current
    const session = getSessionVersion()
    const active = () => current === sequence.current && session === getSessionVersion()
    setLoading(true)
    setError('')
    try {
      if (!Number.isInteger(id) || id <= 0) throw new Error('素材 ID 缺失或无效')
      const data = await getAttachment(id)
      if (active()) setItem(data)
    } catch (cause) {
      if (active()) setError(errorMessage(cause))
    } finally {
      if (active()) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    return () => {
      sequence.current++
    }
  }, [id, guard.ready, guard.allowed])
  useEffect(
    () => () => {
      audio.current?.destroy()
      audio.current = null
    },
    [],
  )
  useEffect(() => {
    if (!guard.allowed || !canReadOptions) return
    const session = getSessionVersion()
    let alive = true
    const active = () => alive && session === getSessionVersion()
    // 七牛素材需要域名拼链接；拿不到时链接退化为空，页面照常显示
    getCloudUploadConfig()
      .then((config) => {
        if (active()) setDomain(config.domain)
      })
      .catch(() => {
        if (active()) setDomain(undefined)
      })
    return () => {
      alive = false
    }
  }, [guard.allowed, canReadOptions])
  useDidHide(() => {
    refreshOnShow.current = true
    setMore(false)
    audio.current?.stop()
  })
  useDidShow(() => {
    if (refreshOnShow.current) {
      refreshOnShow.current = false
      void load()
    }
  })

  async function remove() {
    if (!item || locked.current || !isCurrent([DELETE])) return
    const session = getSessionVersion()
    const current = () => session === getSessionVersion() && isCurrent([DELETE])
    setMore(false)
    locked.current = true
    setBusy(true)
    try {
      const ok = await confirmAction({ title: '删除素材', content: `确认删除「${item.name || item.originalName}」？` })
      if (!ok || !current()) return
      await deleteAttachment(item.id)
      if (!current()) return
      void Taro.showToast({ title: '已删除', icon: 'success' })
      navigateBack(1)
    } catch (cause) {
      if (current()) void Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    } finally {
      locked.current = false
      if (current()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const url = item ? attachmentUrl(item, domain) : ''
  const copy = () => {
    if (!url) return
    const session = getSessionVersion()
    const current = () => session === getSessionVersion() && isCurrent()
    Taro.setClipboardData({ data: url })
      .then(() => {
        if (current()) void Taro.showToast({ title: '已复制', icon: 'success' })
      })
      .catch(() => {
        if (current()) void Taro.showToast({ title: '复制失败', icon: 'none' })
      })
  }
  const playAudio = () => {
    if (!url) return
    audio.current?.destroy()
    const player = Taro.createInnerAudioContext()
    audio.current = player
    player.src = url
    player.onError(() => void Taro.showToast({ title: '音频无法播放', icon: 'none' }))
    player.play()
  }
  const actions: BottomAction[] = [
    ...(canUpdate
      ? [{ key: 'edit', label: '编辑', icon: 'pencil' as const, tone: 'primary' as const, onClick: () => navigateTo(`/${SYSTEM_PAGES.attachmentForm}?id=${id}`) }]
      : []),
    ...(url ? [{ key: 'copy', label: '复制链接', icon: 'file' as const, tone: 'muted' as const, onClick: copy }] : []),
    ...(canDelete
      ? [{ key: 'more', label: '更多', icon: 'moreVertical' as const, tone: 'muted' as const, onClick: () => setMore(true) }]
      : []),
  ]
  const metadata = item?.metadata == null || (typeof item.metadata === 'object' && !Object.keys(item.metadata as object).length)
    ? ''
    : JSON.stringify(item.metadata, null, 2)

  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="素材详情" /> : null}
      <DetailContent>
        <StateView kind={error ? 'error' : loading && !item ? 'loading' : !item ? 'empty' : 'ready'} text={error || undefined} onRetry={load} minHeight={300}>
          {item ? (
            <>
              <View className={styles.preview}>
                {!url || failedUrl === url ? (
                  <View className={styles.placeholder}>
                    <LineIcon name={KIND_GLYPH[item.kind]} size={32} color="#86909C" />
                    <Text className={styles.placeholderText}>
                      {!url ? '暂无可预览链接' : item.kind === 'video' ? '视频无法播放' : '图片无法加载'}
                    </Text>
                  </View>
                ) : item.kind === 'image' ? (
                  <Image className={styles.media} src={url} mode="widthFix" onError={() => setFailedUrl(url)} onClick={() => Taro.previewImage({ current: url, urls: [url] })} />
                ) : item.kind === 'video' ? (
                  <Video className={styles.media} src={url} controls onError={() => setFailedUrl(url)} />
                ) : item.kind === 'audio' ? (
                  <View className={styles.audio}>
                    <View className={styles.audioButton} aria-label="播放" onClick={playAudio}><Text>播放</Text></View>
                    <View className={styles.audioButton} aria-label="停止" onClick={() => audio.current?.stop()}><Text>停止</Text></View>
                  </View>
                ) : (
                  <View className={styles.placeholder}>
                    <LineIcon name="file" size={32} color="#1677FF" />
                    <Text className={styles.placeholderText}>{item.originalName}</Text>
                  </View>
                )}
                <Text className={styles.name}>{item.name || item.originalName}</Text>
                <Text className={styles.note}>{`${KIND_LABELS[item.kind]}，${formatSize(item.size)}`}</Text>
              </View>

              <DetailSection title="基本信息">
                <DetailRow label="名称" value={item.name || item.originalName} />
                <DetailRow label="分组" value={item.folderName || '未分组'} />
                <DetailRow label="类型" value={KIND_LABELS[item.kind]} />
                <DetailRow label="状态" value={item.status === '1' ? '启用' : '禁用'} />
                <DetailRow label="大小" value={formatSize(item.size)} />
                {item.width && item.height ? <DetailRow label="尺寸" value={`${item.width} × ${item.height}`} /> : null}
                {item.duration ? <DetailRow label="时长" value={`${item.duration} 秒`} /> : null}
              </DetailSection>

              <DetailSection title="文件信息">
                <DetailRow label="原始文件" value={item.originalName} />
                <DetailRow label="MIME" value={item.mimeType} />
                <DetailRow label="存储" value={item.storage === 'qiniu' ? '七牛云' : item.storage === 'local' ? '本地存储' : item.storage} />
                {url ? <DetailRow label="文件链接" value="点击复制" showArrow={false} onClick={copy} /> : null}
              </DetailSection>

              {metadata ? (
                <DetailSection title="扩展信息">
                  <DetailRow label="内容" value={metadata} multiline />
                </DetailSection>
              ) : null}

              <DetailSection title="账号记录" collapsible defaultCollapsed>
                <DetailRow label="创建时间" value={formatDateTime(item.createdAt)} />
                <DetailRow label="更新时间" value={formatDateTime(item.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
      <BottomActionBar actions={actions} disabled={busy || loading} />
      <ActionSheet
        open={more}
        items={[{ key: 'delete', label: '删除素材', icon: 'trash', danger: true, onClick: () => void remove() }]}
        onClose={() => setMore(false)}
      />
    </ManagementPage>
  )
}

export default withAccountScope(AttachmentDetailPage)
