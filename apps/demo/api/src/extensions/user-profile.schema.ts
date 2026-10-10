import { int, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core'

export const demoUserProfile = mysqlTable('demo_user_profile', {
  userId: int('user_id').primaryKey(),
  theme: varchar('theme', { length: 20 }).notNull().default('system'),
  lastEvent: varchar('last_event', { length: 30 }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
})
