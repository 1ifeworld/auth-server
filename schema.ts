import { numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users', {
  id: numeric('userid').primaryKey(),
  to: text('to'),
  recovery: text('recovery'),
  timestamp: timestamp('timestamp'),
  log_addr: text('log_addr'),
  block_num: numeric('block_num'),
})

export type InsertUser = typeof usersTable.$inferInsert
export type SelectUser = typeof usersTable.$inferSelect

export const sessionsTable = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: numeric('userid')
    .notNull()
    .references(() => usersTable.id),
  deviceid: text('deviceid').notNull(),
  created: timestamp('created'),
  expiresAt: timestamp('expiresat').notNull(),
})

export type InsertSession = typeof sessionsTable.$inferInsert
export type SelectSession = typeof sessionsTable.$inferSelect

export const hashesTable = pgTable(
  'hashes',
  {
    userid: numeric('userid')
      .notNull()
      .references(() => usersTable.id),
    custodyAddress: text('custodyAddress').notNull(),
    deviceid: text('deviceid').notNull(),
    encryptedpublickey: text('encryptedpublickey').notNull(),
    encryptedprivatekey: text('encryptedprivatekey').notNull(),
  },
  (table) => ({
    primaryKey: [table.userid, table.custodyAddress, table.deviceid],
  }),
)

export type InsertHash = typeof hashesTable.$inferInsert
export type SelectHash = typeof hashesTable.$inferSelect
