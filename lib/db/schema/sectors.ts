import { pgTable, integer, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const sectors = pgTable('sectors', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  color: varchar('color', { length: 7 }),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Sector = typeof sectors.$inferSelect
export type NewSector = typeof sectors.$inferInsert
