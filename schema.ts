import { pgTable, text, numeric, timestamp } from 'drizzle-orm/pg-core'

// Define the users table
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

// Define the sessions table with the required columns
export const sessionsTable = pgTable('sessions', {
  id: text('sessionid').primaryKey(),
  userid: text('userid').notNull().references(() => usersTable.id),
  deviceid: text('deviceid').notNull(),
  created: timestamp('created'),
  expiration: timestamp('expiration').notNull(),
  expiresAt: timestamp('expiresAt').notNull(), // Added this column
  userId: text('userId').notNull().references(() => usersTable.id), // Added this column
})

export type InsertSession = typeof sessionsTable.$inferInsert
export type SelectSession = typeof sessionsTable.$inferSelect

// Define the hashes table
export const hashesTable = pgTable('hashes', {
  userid: text('userid').notNull().references(() => usersTable.id),
  custodyAddress: text('custodyAddress').notNull(),
  deviceid: text('deviceid').notNull(),
  encryptedpublickey: text('encryptedpublickey').notNull(),
  encryptedprivatekey: text('encryptedprivatekey').notNull(),
}, (table) => ({
  primaryKey: [table.userid, table.custodyAddress, table.deviceid],
}))

export type InsertHash = typeof hashesTable.$inferInsert
export type SelectHash = typeof hashesTable.$inferSelect