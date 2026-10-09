/**
 * portal 模块 Drizzle 表定义。
 *
 * 命名约定：表名以 `<meta.id>_` 为前缀。
 * 本模块 meta.id = 'portal'，所以表名 = portal_categories / portal_articles / ...
 *
 * 实体关系：
 *   - portal_articles ↔ portal_categories：多对多，经 portal_article_categories 桥接
 *   - portal_articles / portal_pages：可选关联 portal_templates（type=0/1）
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const portalCategories = mysqlTable(
  'portal_categories',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 100 }).notNull(),
    slug: varchar({ length: 100 }),
    parentId: int('parent_id'),
    status: tinyint().notNull().default(1),
    sortOrder: int('sort_order').notNull().default(0),
    description: varchar({ length: 255 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    uniqSlug: uniqueIndex('uniq_portal_categories_slug').on(t.slug),
    idxStatus: index('idx_portal_categories_status').on(t.status),
    idxParent: index('idx_portal_categories_parent_id').on(t.parentId),
    idxDeletedAt: index('idx_portal_categories_deleted_at').on(t.deletedAt),
    uniqParentName: uniqueIndex('uniq_portal_categories_parent_name').on(t.parentId, t.name),
  }),
)

export const portalArticles = mysqlTable(
  'portal_articles',
  {
    id: int().primaryKey().autoincrement().notNull(),
    title: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 200 }),
    summary: varchar({ length: 500 }),
    content: text().notNull(),
    coverImage: varchar('cover_image', { length: 500 }),
    status: tinyint().notNull().default(0),
    isPinned: boolean('is_pinned').notNull().default(false),
    publishTime: datetime('publish_time'),
    attributes: json(),
    tags: json(),
    templateId: int('template_id'),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    uniqSlug: uniqueIndex('uniq_portal_articles_slug').on(t.slug),
    idxStatus: index('idx_portal_articles_status').on(t.status),
    idxTemplate: index('idx_portal_articles_template_id').on(t.templateId),
    idxPublishTime: index('idx_portal_articles_publish_time').on(t.publishTime),
    idxDeletedAt: index('idx_portal_articles_deleted_at').on(t.deletedAt),
  }),
)

export const portalArticleCategories = mysqlTable(
  'portal_article_categories',
  {
    id: int().primaryKey().autoincrement().notNull(),
    articleId: int('article_id').notNull(),
    categoryId: int('category_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxArticle: index('idx_portal_article_categories_article_id').on(t.articleId),
    idxCategory: index('idx_portal_article_categories_category_id').on(t.categoryId),
    uniqArticleCategory: uniqueIndex('uniq_portal_article_categories').on(t.articleId, t.categoryId),
  }),
)

export const portalPages = mysqlTable(
  'portal_pages',
  {
    id: int().primaryKey().autoincrement().notNull(),
    title: varchar({ length: 200 }).notNull(),
    path: varchar({ length: 255 }).notNull(),
    content: text().notNull(),
    status: tinyint().notNull().default(1),
    attributes: json(),
    publishTime: datetime('publish_time'),
    templateId: int('template_id'),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    uniqPath: uniqueIndex('uniq_portal_pages_path').on(t.path),
    idxStatus: index('idx_portal_pages_status').on(t.status),
    idxTemplate: index('idx_portal_pages_template_id').on(t.templateId),
    idxDeletedAt: index('idx_portal_pages_deleted_at').on(t.deletedAt),
  }),
)

export const portalTemplates = mysqlTable(
  'portal_templates',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: varchar({ length: 255 }),
    type: tinyint().notNull(),
    schema: json(),
    config: json(),
    status: tinyint().notNull().default(1),
    isSystemDefault: boolean('is_system_default').notNull().default(false),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    idxType: index('idx_portal_templates_type').on(t.type),
    idxStatus: index('idx_portal_templates_status').on(t.status),
    idxDeletedAt: index('idx_portal_templates_deleted_at').on(t.deletedAt),
    uniqTypeName: uniqueIndex('uniq_portal_templates_type_name').on(t.type, t.name),
  }),
)
