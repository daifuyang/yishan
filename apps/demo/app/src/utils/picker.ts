/** 小程序/H5 选择器被用户取消时会以 `{ errMsg: '...cancel...' }` reject，这类失败不应提示错误。 */
export function isPickerCancel(reason: unknown): boolean {
  return Boolean(
    reason &&
      typeof reason === 'object' &&
      'errMsg' in reason &&
      String((reason as { errMsg: unknown }).errMsg).includes('cancel'),
  )
}
