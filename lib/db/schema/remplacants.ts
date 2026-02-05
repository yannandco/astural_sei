import { pgTable, integer, uuid, varchar, text, boolean, timestamp, date, index } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { collaborateurs } from './collaborateurs'

// ─── Remplaçants ──────────────────────────────────────────────

export const remplacants = pgTable('remplacants', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  // Disponibilité période actuelle
  isAvailable: boolean('is_available').notNull().default(true),
  availabilityNote: text('availability_note'),
  // Dates contrat
  contractStartDate: date('contract_start_date'),
  contractEndDate: date('contract_end_date'),
  // Observation temporaire (import Excel)
  obsTemporaire: text('obs_temporaire'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('remplacants_last_name_idx').on(table.lastName),
  index('remplacants_is_active_idx').on(table.isActive),
  index('remplacants_is_available_idx').on(table.isAvailable),
])

// ─── Remarques (notes datées avec auteur) ─────────────────────

export const remplacantRemarques = pgTable('remplacant_remarques', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  remplacantId: integer('remplacant_id')
    .notNull()
    .references(() => remplacants.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('remplacant_remarques_remplacant_id_idx').on(table.remplacantId),
  index('remplacant_remarques_created_at_idx').on(table.createdAt),
])

// ─── Observateurs (collaborateurs qui suivent le remplaçant) ──

export const remplacantObservateurs = pgTable('remplacant_observateurs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  remplacantId: integer('remplacant_id')
    .notNull()
    .references(() => remplacants.id, { onDelete: 'cascade' }),
  collaborateurId: integer('collaborateur_id')
    .notNull()
    .references(() => collaborateurs.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('remplacant_observateurs_remplacant_id_idx').on(table.remplacantId),
  index('remplacant_observateurs_collaborateur_id_idx').on(table.collaborateurId),
])

// ─── Types ───────────────────────────────────────────────────

export type Remplacant = typeof remplacants.$inferSelect
export type NewRemplacant = typeof remplacants.$inferInsert
export type RemplacantRemarque = typeof remplacantRemarques.$inferSelect
export type NewRemplacantRemarque = typeof remplacantRemarques.$inferInsert
export type RemplacantObservateur = typeof remplacantObservateurs.$inferSelect
export type NewRemplacantObservateur = typeof remplacantObservateurs.$inferInsert
