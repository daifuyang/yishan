import Taro from '@tarojs/taro'
import type { UploadFile } from '@/api/admin/attachments'
import { isPickerCancel } from '@/utils/picker'

/** 小程序从会话选择文件；用户取消返回空数组。 */
export async function chooseFiles(): Promise<UploadFile[]> {
  try {
    const result = await Taro.chooseMessageFile({ count: 9, type: 'all' })
    return result.tempFiles.map((file) => ({
      path: file.path,
      name: file.name,
      size: file.size,
      mimeType: 'application/octet-stream',
    }))
  } catch (reason) {
    if (isPickerCancel(reason)) return []
    throw reason
  }
}
