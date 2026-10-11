import { useRef } from 'react'
import { Button } from '@/components/atoms'
import type { UploadFile } from '@/api/admin/attachments'

export default function FileUpload({ disabled, onFiles, onError, label = '选择文件' }: { disabled: boolean; onFiles: (files: UploadFile[]) => Promise<void>; onError: (error: unknown) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  return <><Button size="sm" disabled={disabled} onClick={() => input.current?.click()}>{label}</Button>
    <input ref={input} type="file" multiple disabled={disabled} style={{ display: 'none' }} onChange={async (event) => {
      const files = Array.from(event.currentTarget.files || []).map((file) => ({ path: URL.createObjectURL(file), name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' }))
      event.currentTarget.value = ''
      try { await onFiles(files) } catch (reason) { onError(reason) }
      finally { for (const file of files) URL.revokeObjectURL(file.path) }
    }} />
  </>
}
