/**
 * portal 模块的种子入口。
 *
 * 编排脚本（scripts/onboard-modules.ts）通过 `seedModule()` 顶层副作用触发本文件：
 *   - 从 ./config/system-menu.json 读取模块菜单树，递归铺平写入 sys_menu
 *   - 把按钮对应的权限码绑到 sys_menu_permission
 *
 * 菜单树结构与 demo 模块的 seed.ts 一致（共享同一套 menuTree 展开 / upsert 逻辑），
 * 这里 inline 简化以保持模块自包含；后续若重复 ≥3 次可抽到 core。
 */

import { eq } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { sysMenu, sysMenuPermission, sysUser } from '@/db/schema'
import adminMenu from './config/system-menu.json'
import { portalArticles, portalArticleCategories, portalCategories, portalPages, portalTemplates } from './db/schema.js'

export type AdminMenuNode = {
  type: 0 | 1 | 2
  name: string
  path?: string
  sortOrder: number
  icon?: string
  component?: string
  hideInMenu?: 0 | 1
  permissionCodes?: string[]
  isDefaultAction?: 0 | 1
  children?: AdminMenuNode[]
}

const menuTree = adminMenu as AdminMenuNode[]
export const toBool = (n: 0 | 1 | undefined): boolean => n === 1

export type FlatNode = {
  node: AdminMenuNode
  depth: number
  parentPath: string | null
}

export function flattenMenuTree(nodes: AdminMenuNode[]): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (list: AdminMenuNode[], depth: number, parentPath: string | null): void => {
    for (const node of list) {
      const myPath = node.path ?? parentPath
      out.push({ node, depth, parentPath })
      if (node.children && node.children.length > 0) {
        walk(node.children, depth + 1, myPath)
      }
    }
  }
  walk(nodes, 0, null)
  return out
}

async function upsertTree(
  nodes: AdminMenuNode[],
  parentId: number | null,
  creatorId: number,
): Promise<void> {
  for (const decl of nodes) {
    const id = await upsertOne(decl, parentId, creatorId)
    if (decl.children && decl.children.length > 0) {
      await upsertTree(decl.children, id, creatorId)
    }
  }
}

async function upsertOne(
  decl: AdminMenuNode,
  parentId: number | null,
  creatorId: number,
): Promise<number> {
  if (!decl.path) {
    // 按钮节点（type=2）无独立 path，权限码由 bindMenuPermissions 处理
    return parentId ?? 0
  }
  const existing = await drizzleDb.query.sysMenu.findFirst({
    where: eq(sysMenu.path, decl.path),
  })
  if (existing) {
    await drizzleDb
      .update(sysMenu)
      .set({
        name: decl.name,
        type: decl.type,
        parentId,
        component: decl.component ?? existing.component,
        icon: decl.icon,
        sortOrder: decl.sortOrder,
        updaterId: creatorId,
        status: 1,
        hideInMenu: toBool(decl.hideInMenu),
      })
      .where(eq(sysMenu.id, existing.id))
    return existing.id
  }
  await drizzleDb.insert(sysMenu).values({
    name: decl.name,
    path: decl.path,
    type: decl.type,
    parentId,
    component: decl.component,
    icon: decl.icon,
    sortOrder: decl.sortOrder ?? 99,
    status: 1,
    hideInMenu: toBool(decl.hideInMenu),
    isDefaultAction: toBool(decl.isDefaultAction),
    isExternalLink: false,
    keepAlive: false,
    creatorId,
    updaterId: creatorId,
  })
  const created = await drizzleDb.query.sysMenu.findFirst({
    where: eq(sysMenu.path, decl.path),
  })
  if (!created) {
    throw new Error(`菜单写入后未找到：${decl.path}`)
  }
  return created.id
}

async function bindMenuPermissions(menuId: number, codes: string[]): Promise<void> {
  if (codes.length === 0) return
  for (const code of codes) {
    await drizzleDb
      .insert(sysMenuPermission)
      .values({ menuId, permissionCode: code })
      .onDuplicateKeyUpdate({ set: { permissionCode: code } })
  }
}

async function bindAllPermissions(flat: FlatNode[], creatorId: number): Promise<void> {
  for (const { node, parentPath } of flat) {
    if (!node.permissionCodes || node.permissionCodes.length === 0) continue
    const anchorPath = node.path ?? parentPath
    if (!anchorPath) {
      throw new Error(`bindAllPermissions 找不到可绑定的菜单行：${node.name}`)
    }
    const row = await drizzleDb.query.sysMenu.findFirst({
      where: eq(sysMenu.path, anchorPath),
    })
    if (!row) {
      throw new Error(`bindAllPermissions 找不到菜单：${anchorPath}`)
    }
    await bindMenuPermissions(row.id, node.permissionCodes)
  }
}

export default async function seedPortal(): Promise<void> {
  const [admin] = await drizzleDb
    .select({ id: sysUser.id })
    .from(sysUser)
    .where(eq(sysUser.username, 'admin'))
    .limit(1)
  const creatorId = admin?.id ?? 1

  await upsertTree(menuTree, null, creatorId)
  const flat = flattenMenuTree(menuTree)
  await bindAllPermissions(flat, creatorId)

  // ─── 示例数据（来自 commit 164dd06 的 portal-*.json）───
  // 模块自带的 demo 数据，跟着 db:seed 一起插入；upsert 语义保证重复执行
  // 是幂等的（同一 slug 不重复插入）。
  await seedSampleData(creatorId)
}

/**
 * 3 个分类 + 3 篇文章 + 3 个页面 + 2 个模板。
 *
 * 字段映射：
 *   categorySlugs（旧）→ categoryIds（新）= 通过 slug 解析回 id
 *   templates.type: 0 (article) / 1 (page)
 *
 * 如果某些样本数据已存在（重复跑 db:seed），upsert 不会破坏原记录。
 */
async function seedSampleData(creatorId: number): Promise<void> {
  // 1. 分类
  const categoriesData = [
    { name: '新闻',     slug: 'news',   sortOrder: 1, description: '公司新闻' },
    { name: '公告',     slug: 'notice', sortOrder: 2, description: '系统公告' },
    { name: '技术博客', slug: 'blog',   sortOrder: 3, description: '技术分享' },
  ]
  const categoryIds = new Map<string, number>()
  for (const c of categoriesData) {
    const existing = await drizzleDb
      .select({ id: portalCategories.id })
      .from(portalCategories)
      .where(eq(portalCategories.slug, c.slug))
      .limit(1)
    if (existing.length > 0) {
      categoryIds.set(c.slug, existing[0].id)
    } else {
      const [inserted] = await drizzleDb
        .insert(portalCategories)
        .values({
          name: c.name,
          slug: c.slug,
          sortOrder: c.sortOrder,
          description: c.description,
          status: 1,
          creatorId,
          updaterId: creatorId,
        })
        .$returningId()
      categoryIds.set(c.slug, inserted.id)
    }
  }

  // 2. 文章
  const articlesData = [
    {
      title: '欢迎使用门户',
      slug: 'welcome',
      content: '这是门户的欢迎文章',
      categorySlugs: ['news'],
      status: 1,
      isPinned: true,
      tags: ['置顶', '公告'],
      attributes: { readingTime: 3 },
    },
    {
      title: '系统发布 1.0',
      slug: 'release-1-0',
      content: '系统 1.0 版本发布说明',
      categorySlugs: ['notice'],
      status: 1,
      isPinned: false,
      tags: ['发布'],
      attributes: { version: '1.0.0' },
    },
    {
      title: '使用指南',
      slug: 'how-to-use',
      content: '系统使用指南与最佳实践',
      categorySlugs: ['blog'],
      status: 1,
      isPinned: false,
      tags: ['指南'],
      attributes: { level: 'beginner' },
    },
    {
      title: '密码忘了怎么办？看这里',
      slug: 'forgot-password',
      content: [
        '## 当前系统没有"邮件找回"功能',
        '',
        '本系统**没有**自带的"忘记密码 → 邮件重置链接"流程（`sys_user` 表里也没有 `resetToken` 之类的字段）。',
        '如果忘了密码，只能通过下面两种现有路径解决。',
        '',
        '## 路径一：找管理员重置（推荐）',
        '',
        '联系超级管理员 / 系统管理员，让他：',
        '1. 进入 **系统管理 → 用户管理**（`/system/user`）。',
        '2. 找到你的账号（按用户名 / 邮箱 / 手机号搜索）。',
        '3. 点"编辑"，在 `password` 字段填入**临时密码**，保存。',
        '4. 你用这个临时密码登录。',
        '',
        '> 管理员重置走的是 `PUT /api/v1/admin/users/{id}` 接口（`updateUserReq` 里的 `password` 字段），',
        '> 长度 6-50，必须含字母+数字，pattern: `^(?=.*[a-zA-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{6,}$`。',
        '',
        '## 路径二：自己改密码（记得旧密码时）',
        '',
        '如果你只是定期改密码，没忘：',
        '',
        '1. 登录后，**移动端**走 `PUT /api/v1/app/users/me/password`。',
        '2. body 传 `oldPassword` 和 `newPassword`（同上的 6-50 规则）。',
        '3. 提交后**强制下线所有设备**——`sys_user_token` 表里这个 userId 的所有 token 会被打 `is_revoked = true, revoked_at = now()`。',
        '4. 你需要用新密码重新登录。',
        '',
        '## 账户被锁了怎么办',
        '',
        '连续输错密码 `MAX_LOGIN_FAILED_ATTEMPTS=5` 次（看 `.env`）后，',
        '账户 `status` 会被置为 `2`（**锁定**），期间无法登录。',
        '解锁方式：',
        '- 等待 `LOGIN_LOCKOUT_DURATION=3600` 秒（1 小时）自动解锁；',
        '- 或管理员在用户管理里把 `status` 改回 `1`（启用）。',
        '',
        '## 修改记录',
        '',
        '- 每次登录成功会写 `lastLoginTime` + `lastLoginIp`，登录计数 `loginCount++`。',
        '- 失败登录会写 `sys_login_log`，管理员可在 **系统管理 → 登录日志** 查你的登录历史。',
        '- 软删账号（`deletedAt` 不为 null）登录会被拒。',
      ].join('\n'),
      summary: '当前系统没有邮件找回功能；只支持管理员重置 / 自己改密码。说明 sys_user / sys_user_token 关键字段、锁定阈值、token 撤销行为。',
      categorySlugs: ['blog'],
      status: 1,
      isPinned: false,
      tags: ['指南', '密码', '安全'],
      attributes: { level: 'beginner' },
    },
  ]
  for (const a of articlesData) {
    const existing = await drizzleDb
      .select({ id: portalArticles.id })
      .from(portalArticles)
      .where(eq(portalArticles.slug, a.slug))
      .limit(1)
    if (existing.length > 0) continue
    // 1) INSERT article
    const [inserted] = await drizzleDb
      .insert(portalArticles)
      .values({
        title: a.title,
        slug: a.slug,
        content: a.content,
        status: a.status,
        isPinned: a.isPinned,
        tags: a.tags,
        attributes: a.attributes,
        creatorId,
        updaterId: creatorId,
      })
      .$returningId()
    // 2) INSERT 关联分类（多对多经 portal_article_categories 桥接）
    const catIds = a.categorySlugs
      .map((s) => categoryIds.get(s))
      .filter((v): v is number => v !== undefined)
    if (catIds.length > 0) {
      await drizzleDb.insert(portalArticleCategories).values(
        catIds.map((cid) => ({ articleId: inserted.id, categoryId: cid })),
      )
    }
  }

  // 3. 页面
  const pagesData = [
    { title: '首页',     path: '/home',    content: '欢迎访问门户网站',  attributes: { banner: '/assets/banner.jpg' } },
    { title: '关于我们', path: '/about',   content: '关于我们页面内容',  attributes: { layout: 'full' } },
    { title: '联系我们', path: '/contact', content: '联系方式与地址',     attributes: { form: true } },
  ]
  for (const p of pagesData) {
    const existing = await drizzleDb
      .select({ id: portalPages.id })
      .from(portalPages)
      .where(eq(portalPages.path, p.path))
      .limit(1)
    if (existing.length > 0) continue
    await drizzleDb.insert(portalPages).values({
      title: p.title,
      path: p.path,
      content: p.content,
      attributes: p.attributes,
      status: 1,
      creatorId,
      updaterId: creatorId,
    })
  }

  // 4. 模板
  const templatesData = [
    { name: '默认详情', type: 0, description: '系统默认文章详情模板' },
    { name: '默认页面', type: 1, description: '系统默认页面模板'   },
  ]
  for (const t of templatesData) {
    const existing = await drizzleDb
      .select({ id: portalTemplates.id })
      .from(portalTemplates)
      .where(eq(portalTemplates.name, t.name))
      .limit(1)
    if (existing.length > 0) continue
    await drizzleDb.insert(portalTemplates).values({
      name: t.name,
      type: t.type,
      description: t.description,
      status: 1,
      creatorId,
      updaterId: creatorId,
    })
  }
}

// 模块顶层自动执行：onboard-modules.ts 通过 spawn `node seed.js` 触发
if (require.main === module) {
  seedPortal().catch((err) => {
    console.error('[portal seed] 异常退出:', err)
    process.exit(1)
  })
}
