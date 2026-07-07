/**
 * 通用确认弹窗 hook（包装 Taro.showModal 为 Promise）
 */
import Taro from '@tarojs/taro'

export interface ConfirmOptions {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
  cancelColor?: string
}

export async function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  const res = await Taro.showModal({
    title: opts.title ?? '提示',
    content: opts.content,
    confirmText: opts.confirmText ?? '确定',
    cancelText: opts.cancelText ?? '取消',
    confirmColor: opts.confirmColor ?? '#1677FF',
    cancelColor: opts.cancelColor,
  })
  return res.confirm
}
