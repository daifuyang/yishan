/** Stable attachment types. Mirrors generated `API.sysAttachment`,
 * `API.sysAttachmentFolder`, and `API.uploadAttachmentsResp`. */

export type AttachmentKind = 'image' | 'audio' | 'video' | 'other'

export interface Attachment {
  /** 素材ID */
  id: number
  /** 分组ID */
  folderId?: number
  /** 分组名称 */
  folderName?: string
  /** 素材类型 */
  kind: AttachmentKind
  /** 素材名称 */
  name?: string
  /** 原始文件名 */
  originalName: string
  /** 存储文件名 */
  filename: string
  /** 扩展名 */
  ext?: string
  /** MIME 类型 */
  mimeType: string
  /** 文件大小（字节） */
  size: number
  /** 存储类型 */
  storage: string
  /** 本地路径 */
  path?: string
  /** 可访问URL */
  url?: string
  /** 对象存储Key */
  objectKey?: string
  /** 内容哈希 */
  hash?: string
  /** 图片宽度 */
  width?: number
  /** 图片高度 */
  height?: number
  /** 音视频时长（秒） */
  duration?: number
  /** 扩展信息 */
  metadata?: unknown
  /** 状态（0-禁用，1-启用） */
  status: '0' | '1'
  /** 创建人Id */
  creatorId?: number
  /** 创建人名称 */
  creatorName?: string
  /** 创建时间 */
  createdAt: string
  /** 更新人Id */
  updaterId?: number
  /** 更新人名称 */
  updaterName?: string
  /** 更新时间 */
  updatedAt: string
}

export interface AttachmentFolder {
  /** 分组ID */
  id: number
  /** 分组名称 */
  name: string
  /** 父分组ID */
  parentId?: number
  /** 分组类型 */
  kind: 'all' | 'image' | 'audio' | 'video' | 'other'
  /** 状态（0-禁用，1-启用） */
  status: '0' | '1'
  /** 排序序号 */
  sort_order: number
  /** 备注 */
  remark?: string
  /** 创建人Id */
  creatorId?: number
  /** 创建人名称 */
  creatorName?: string
  /** 创建时间 */
  createdAt: string
  /** 更新人Id */
  updaterId?: number
  /** 更新人名称 */
  updaterName?: string
  /** 更新时间 */
  updatedAt: string
  children?: AttachmentFolder[]
}

export interface UploadedAttachment {
  id?: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  kind?: AttachmentKind
  url?: string
}

export interface UploadAttachmentsResp {
  code: number
  message: string
  success: boolean
  data: UploadedAttachment[]
  timestamp: string
}
