import Taro from '@tarojs/taro'
import { Button } from '@/components/atoms'
import type { UploadFile } from '@/api/admin/attachments'

export default function FileUpload({ disabled, onFiles, onError, label = '选择文件' }: { disabled: boolean; onFiles: (files: UploadFile[]) => Promise<void>; onError: (error: unknown) => void; label?: string }) {
  const choose = async () => {
    if (disabled) return
    try {
      const result = await Taro.chooseMessageFile({ count: 9, type: 'all' })
      await onFiles(result.tempFiles.map((file) => ({ path: file.path, name: file.name, size: file.size, mimeType: 'application/octet-stream' })))
    } catch (reason) {
      if (reason && typeof reason === 'object' && 'errMsg' in reason && String(reason.errMsg).includes('cancel')) return
      onError(reason)
    }
  }
  return <Button size="sm" disabled={disabled} onClick={choose}>{label}</Button>
}
