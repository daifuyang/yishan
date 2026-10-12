import type { UploadFile } from '@/api/admin/attachments'

/**
 * H5 文件选择。必须在用户点击的同一调用栈内调用：input.click() 同步发生，
 * 前面有任何 await 浏览器都会拦截弹窗。调用方用完后自行 URL.revokeObjectURL。
 */
export function chooseFiles(): Promise<UploadFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)
    const done = (files: UploadFile[]) => {
      document.body.removeChild(input)
      resolve(files)
    }
    input.onchange = () =>
      done(
        Array.from(input.files || []).map((file) => ({
          path: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        })),
      )
    input.oncancel = () => done([])
    input.click()
  })
}
