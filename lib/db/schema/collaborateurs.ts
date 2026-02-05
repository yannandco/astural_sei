import { pgTable, integer, uuid, varchar, text, boolean, timestamp, date, decimal, index } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { sectors } from './sectors'
import { contratTypeEnum, sexeEnum } from './enums'

export const collaborateurs = pgTable('collaborateurs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  mobilePro: varchar('mobile_pro', { length: 30 }),
  email: varchar('email', { length: 255 }),
  secteurId: integer('secteur_id').references(() => sectors.id, { onDelete: 'set null' }),
  taux: decimal('taux', { precision: 5, scale: 2 }),
  contratType: contratTypeEnum('contrat_type'),
  contratDetails: text('contrat_details'),
  canton: varchar('canton', { length: 50 }),
  pays: varchar('pays', { length: 100 }),
  sexe: sexeEnum('sexe'),
  dateSortie: date('date_sortie'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('collaborateurs_secteur_id_idx').on(table.secteurId),
  index('collaborateurs_email_idx').on(table.email),
  index('collaborateurs_last_name_idx').on(table.lastName),
  index('collaborateurs_is_active_idx').on(table.isActive),
  index('collaborateurs_contrat_type_idx').on(table.contratType),
])

export type Collaborateur = typeof collaborateurs.$inferSelect
export type NewCollaborateur = typeof collaborateurs.$inferInsert
