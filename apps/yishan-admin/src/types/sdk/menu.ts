/** Stable menu tree types. Mirrors generated `API.menuTreeNode` /
 * `API.menuTreeList`. */

export interface MenuTreeNode {
  /** 菜单ID */
  id: number
  /** 菜单名称 */
  name: string
  /** 类型（0:目录,1:菜单,2:按钮） */
  type: 0 | 1 | 2
  /** 路由路径/URL */
  path?: string
  /** 图标名 */
  icon?: string
  /** 前端组件路径 */
  component?: string
  /** 父级菜单ID */
  parentId?: number
  /** 父级菜单名称 */
  parentName?: string
  /** 状态（0-禁用，1-启用） */
  status: '0' | '1'
  /** 排序序号 */
  sort_order: number
  /** 是否在菜单中隐藏 */
  hideInMenu: boolean
  /** 是否为页面默认访问操作 */
  isDefaultAction: boolean
  /** 是否外链 */
  isExternalLink: boolean
  /** 关联功能权限码 */
  permissionCodes: string[]
  /** 是否缓存页面 */
  keepAlive: boolean
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
  children?: MenuTreeNode[] | null
}

export type MenuTreeList = MenuTreeNode[]
