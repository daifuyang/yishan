/**
 * portal 模块的种子入口。
 *
 * 菜单声明经公开 System 服务写入，示例业务数据仅在不存在时插入。
 */

import { resolveSeedActor, seedModuleMenus, type MenuSeedNode } from '@yishan/core-system-api'
import { eq } from 'drizzle-orm'
import { drizzleDb } from '@yishan/core-system-api/database'
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

function toMenuSeedNodes(nodes: AdminMenuNode[]): MenuSeedNode[] {
  return nodes.map((node) => ({
    ...node,
    hideInMenu: toBool(node.hideInMenu),
    isDefaultAction: toBool(node.isDefaultAction),
    children: node.children ? toMenuSeedNodes(node.children) : undefined,
  }))
}

export default async function seedPortal(): Promise<void> {
  const admin = await resolveSeedActor()
  const creatorId = admin?.id ?? 1

  await seedModuleMenus('portal', toMenuSeedNodes(menuTree), creatorId)

  // ─── 示例数据（来自 commit 164dd06 的 portal-*.json）───
  // 已有 slug 的记录直接跳过，避免覆盖用户维护的业务数据。
  await seedSampleData(creatorId)
}

/**
 * 3 个分类 + 3 篇文章 + 3 个页面 + 2 个模板。
 *
 * 字段映射：
 *   categorySlugs（旧）→ categoryIds（新）= 通过 slug 解析回 id
 *   templates.type: 0 (article) / 1 (page)
 *
 * 重复执行只补缺失的样本，不更新已有记录。
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
