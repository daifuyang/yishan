import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useRef, useState } from 'react'
import { attachmentUrl, uploadAttachment } from '@/api/admin/attachments'
import { ActionSheet, FormField, LineIcon } from '@/components/management'
import { useCanWrite } from '@/hooks'
import { isPickerCancel } from '@/utils/picker'
import { errorMessage } from '../../_shared/AdminUI'
import { previewImage } from '../model'
import styles from './LogoField.module.scss'

export interface LogoFieldProps {
  value: string
  onChange: (value: string) => void
  onError: (message: string) => void
  disabled?: boolean
}

/**
 * Logo 行：右侧缩略图，点击弹出「上传 / 移除」。上传复用附件模块的接口，
 * 保存的是附件的可访问地址，与 PC 端填写的 Logo 地址同一字段。
 */
export function LogoField({ value, onChange, onError, disabled = false }: LogoFieldProps) {
  const canUpload = useCanWrite('system:attachment:create')
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const locked = useRef(false)
  const preview = previewImage(value)
  const inactive = disabled || uploading

  async function upload() {
    setOpen(false)
    if (inactive || locked.current) return
    locked.current = true
    try {
      const picked = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const file = picked.tempFiles[0]
      if (!file) return
      setUploading(true)
      const [result] = await uploadAttachment(
        {
          path: file.path,
          name: file.originalFileObj?.name || file.path.split('/').pop() || 'logo.png',
          size: file.size,
          mimeType: file.type || 'image/png',
        },
        { kind: 'image' },
      )
      const url = result ? result.url || attachmentUrl({ ...result, storage: 'local' }) : ''
      if (!url) throw new Error('上传成功但未返回图片地址')
      onChange(url)
    } catch (reason) {
      if (isPickerCancel(reason)) return
      onError(errorMessage(reason))
    } finally {
      locked.current = false
      setUploading(false)
    }
  }

  const items = [
    ...(canUpload ? [{ key: 'upload', label: value ? '更换 Logo' : '上传 Logo', icon: 'image' as const, onClick: () => void upload() }] : []),
    ...(value ? [{ key: 'remove', label: '移除 Logo', icon: 'trash' as const, danger: true, onClick: () => { setOpen(false); onChange('') } }] : []),
  ]
  const tappable = !inactive && items.length > 0

  return (
    <>
      <FormField label="Logo" disabled={disabled} arrow={tappable} onArrowClick={() => setOpen(true)}>
        <View className={styles.logo} onClick={tappable ? () => setOpen(true) : undefined}>
          {uploading ? (
            <Text className={styles.logo__placeholder}>上传中…</Text>
          ) : preview ? (
            <Image className={styles.logo__image} src={preview} mode="aspectFit" />
          ) : value ? (
            <Text className={styles.logo__path}>{value}</Text>
          ) : (
            <View className={styles.logo__empty}>
              <LineIcon name="image" size={18} color="#C9CDD4" />
              <Text className={styles.logo__placeholder}>{canUpload ? '点击上传' : '未设置'}</Text>
            </View>
          )}
        </View>
      </FormField>
      <ActionSheet open={open} title="Logo" items={items} onClose={() => setOpen(false)} />
    </>
  )
}
