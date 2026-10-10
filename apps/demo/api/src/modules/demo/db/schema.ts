import { datetime, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

/**
 * 入门演示 Todo 表。
 *
 * 命名约定：表名以 `<meta.id>_` 为前缀。
 * 本模块 meta.id = 'demo'，所以表名 = demo_todos。
 *
 * 本表用于 demo 模块的 /todos 路由，演示
 * module 内的 route → service → repository → drizzleDb 完整分层。
 */
export const demoTodos = mysqlTable('demo_todos', {
  id: int().primaryKey().autoincrement().notNull(),
  title: varchar({ length: 200 }).notNull(),
  description: varchar({ length: 2000 }).notNull().default(''),
  status: int().notNull().default(0), // 0: todo, 1: doing, 2: done
  dueAt: datetime('due_at'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
})
