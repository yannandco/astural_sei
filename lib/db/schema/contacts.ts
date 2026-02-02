import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './auth'

// Contact types table (dynamic, managed by admin)
export const contactTypes = pgTable('contact_types', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // Hex color e.g. #FF5733
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Contacts table
export const contacts = pgTable('contacts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  typeId: integer('type_id').references(() => contactTypes.id, { onDelete: 'set null' }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  mobile: varchar('mobile', { length: 30 }),
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('contacts_type_id_idx').on(table.typeId),
  index('contacts_email_idx').on(table.email),
  index('contacts_last_name_idx').on(table.lastName),
  index('contacts_is_active_idx').on(table.isActive),
])

// Types
export type ContactType = typeof contactTypes.$inferSelect
export type NewContactType = typeof contactTypes.$inferInsert
export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert
