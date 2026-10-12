import type { UploadFile } from '@/api/admin/attachments'

/** 回到页面后再等一会儿：部分浏览器先触发 focus，change 稍后才到。 */
const FOCUS_SETTLE_MS = 300

/**
 * H5 文件选择。必须在用户点击的同一调用栈内调用：input.click() 同步发生，
 * 前面有任何 await 浏览器都会拦截弹窗。调用方用完后自行 URL.revokeObjectURL。
 *
 * input 的 cancel 事件只有较新的浏览器支持；旧 iOS Safari 与部分 WebView 关闭选择框时
 * change / cancel 都不触发，所以再用窗口重新获得焦点兜底，保证 Promise 一定落地、input 一定移除。
 */
export function chooseFiles(): Promise<UploadFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)
    let settled = false
    const onFocus = () => {
      setTimeout(() => {
        if (!settled && !input.files?.length) done([])
      }, FOCUS_SETTLE_MS)
    }
    const done = (files: UploadFile[]) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onFocus)
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
    window.addEventListener('focus', onFocus, { once: true })
  })
}
