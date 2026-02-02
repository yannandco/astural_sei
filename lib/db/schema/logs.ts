import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { logTypeEnum, logPriorityEnum } from './enums'

// Audit logs table
export const logs = pgTable('logs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  actionType: varchar('action_type', { length: 50 }).notNull(), // CREATE, UPDATE, DELETE, LOGIN, etc.
  tableName: varchar('table_name', { length: 100 }),
  recordId: varchar('record_id', { length: 100 }),
  oldValues: text('old_values'), // JSON string
  newValues: text('new_values'), // JSON string
  type: logTypeEnum('type').notNull().default('USER_ACTION'),
  entityType: varchar('entity_type', { length: 50 }), // contact, user, etc.
  entityId: integer('entity_id'),
  metadata: jsonb('metadata'),
  priority: logPriorityEnum('priority').notNull().default('info'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('logs_type_idx').on(table.type),
  index('logs_user_id_idx').on(table.userId),
  index('logs_created_at_idx').on(table.createdAt),
  index('logs_entity_idx').on(table.entityType, table.entityId),
  index('logs_priority_idx').on(table.priority),
])

// Types
export type Log = typeof logs.$inferSelect
export type NewLog = typeof logs.$inferInsert
