import type { PermissionRef } from '@/core/permissions/catalog.js'
import { registerPermissions } from '@/core/permissions/catalog.js'

/**
 * shop 模块权限码。
 *
 * 5 个实体 × 4 个标准动作（list/create/update/delete）。
 * group: 'shop' 用于 admin 权限目录分组展示。
 */
export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  CATEGORY_LIST: { code: 'shop:category:list', label: '商城-分类-查看', group: 'shop' },
  CATEGORY_CREATE: { code: 'shop:category:create', label: '商城-分类-新建', group: 'shop' },
  CATEGORY_UPDATE: { code: 'shop:category:update', label: '商城-分类-编辑', group: 'shop' },
  CATEGORY_DELETE: { code: 'shop:category:delete', label: '商城-分类-删除', group: 'shop' },

  ATTRIBUTE_LIST: { code: 'shop:attribute:list', label: '商城-属性-查看', group: 'shop' },
  ATTRIBUTE_CREATE: { code: 'shop:attribute:create', label: '商城-属性-新建', group: 'shop' },
  ATTRIBUTE_UPDATE: { code: 'shop:attribute:update', label: '商城-属性-编辑', group: 'shop' },
  ATTRIBUTE_DELETE: { code: 'shop:attribute:delete', label: '商城-属性-删除', group: 'shop' },

  PRODUCT_LIST: { code: 'shop:product:list', label: '商城-商品-查看', group: 'shop' },
  PRODUCT_CREATE: { code: 'shop:product:create', label: '商城-商品-新建', group: 'shop' },
  PRODUCT_UPDATE: { code: 'shop:product:update', label: '商城-商品-编辑', group: 'shop' },
  PRODUCT_DELETE: { code: 'shop:product:delete', label: '商城-商品-删除', group: 'shop' },

  SKU_LIST: { code: 'shop:sku:list', label: '商城-SKU-查看', group: 'shop' },
  SKU_CREATE: { code: 'shop:sku:create', label: '商城-SKU-新建', group: 'shop' },
  SKU_UPDATE: { code: 'shop:sku:update', label: '商城-SKU-编辑', group: 'shop' },
  SKU_DELETE: { code: 'shop:sku:delete', label: '商城-SKU-删除', group: 'shop' },

  ORDER_LIST: { code: 'shop:order:list', label: '商城-订单-查看', group: 'shop' },
  ORDER_CREATE: { code: 'shop:order:create', label: '商城-订单-新建', group: 'shop' },
  ORDER_UPDATE: { code: 'shop:order:update', label: '商城-订单-编辑', group: 'shop' },
  ORDER_DELETE: { code: 'shop:order:delete', label: '商城-订单-删除', group: 'shop' },
})

registerPermissions(...Object.values(PERMS))
