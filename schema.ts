import { pgTable, text, numeric, timestamp } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users', {
  id: numeric('id').primaryKey(),
  to: text('to'),
  recovery: text('recovery'),
  timestamp: timestamp('timestamp'),
  log_addr: text('log_addr'),
  block_num: numeric('block_num'),
  session: text('session'),
})

export const sessionsTable = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => usersTable.id), 
  session: text('session'),
  created: timestamp('created'),
  expiresAt: timestamp('expiresAt').notNull(),
})

export type InsertSession = typeof sessionsTable.$inferInsert
export type SelectSession = typeof sessionsTable.$inferSelect

export type InsertUser = typeof usersTable.$inferInsert
export type SelectUser = typeof usersTable.$inferSelect