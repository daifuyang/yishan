import type { PermissionRef } from '@/core/permissions/catalog.js'
import { registerPermissions } from '@/core/permissions/catalog.js'

/**
 * portal 模块权限码。
 *
 * 按实体划分：每个实体 list / create / update / delete 四件套，模板额外多一组。
 * group: 'portal' 用于 admin 权限目录分组展示。
 */
export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  CATEGORY_LIST: { code: 'portal:category:list', label: '门户-分类-查看', group: 'portal' },
  CATEGORY_CREATE: { code: 'portal:category:create', label: '门户-分类-新建', group: 'portal' },
  CATEGORY_UPDATE: { code: 'portal:category:update', label: '门户-分类-编辑', group: 'portal' },
  CATEGORY_DELETE: { code: 'portal:category:delete', label: '门户-分类-删除', group: 'portal' },

  ARTICLE_LIST: { code: 'portal:article:list', label: '门户-文章-查看', group: 'portal' },
  ARTICLE_CREATE: { code: 'portal:article:create', label: '门户-文章-新建', group: 'portal' },
  ARTICLE_UPDATE: { code: 'portal:article:update', label: '门户-文章-编辑', group: 'portal' },
  ARTICLE_DELETE: { code: 'portal:article:delete', label: '门户-文章-删除', group: 'portal' },
  ARTICLE_PUBLISH: { code: 'portal:article:publish', label: '门户-文章-发布', group: 'portal' },

  PAGE_LIST: { code: 'portal:page:list', label: '门户-页面-查看', group: 'portal' },
  PAGE_CREATE: { code: 'portal:page:create', label: '门户-页面-新建', group: 'portal' },
  PAGE_UPDATE: { code: 'portal:page:update', label: '门户-页面-编辑', group: 'portal' },
  PAGE_DELETE: { code: 'portal:page:delete', label: '门户-页面-删除', group: 'portal' },

  ARTICLE_TEMPLATE_LIST: { code: 'portal:article-template:list', label: '门户-文章模板-查看', group: 'portal' },
  ARTICLE_TEMPLATE_CREATE: { code: 'portal:article-template:create', label: '门户-文章模板-新建', group: 'portal' },
  ARTICLE_TEMPLATE_UPDATE: { code: 'portal:article-template:update', label: '门户-文章模板-编辑', group: 'portal' },
  ARTICLE_TEMPLATE_DELETE: { code: 'portal:article-template:delete', label: '门户-文章模板-删除', group: 'portal' },

  PAGE_TEMPLATE_LIST: { code: 'portal:page-template:list', label: '门户-页面模板-查看', group: 'portal' },
  PAGE_TEMPLATE_CREATE: { code: 'portal:page-template:create', label: '门户-页面模板-新建', group: 'portal' },
  PAGE_TEMPLATE_UPDATE: { code: 'portal:page-template:update', label: '门户-页面模板-编辑', group: 'portal' },
  PAGE_TEMPLATE_DELETE: { code: 'portal:page-template:delete', label: '门户-页面模板-删除', group: 'portal' },
})

registerPermissions(...Object.values(PERMS))
