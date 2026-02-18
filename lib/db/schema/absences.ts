import { pgTable, integer, uuid, text, boolean, timestamp, date, index } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { collaborateurs } from './collaborateurs'
import { remplacants } from './remplacants'
import { absenceTypeEnum, absenceMotifEnum, creneauEnum, whatsappMessageStatusEnum, whatsappResponseEnum } from './enums'

// ─── Absences (collaborateurs et remplaçants) ───────────────
export const absences = pgTable('absences', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  type: absenceTypeEnum('type').notNull(),
  collaborateurId: integer('collaborateur_id')
    .references(() => collaborateurs.id, { onDelete: 'cascade' }),
  remplacantId: integer('remplacant_id')
    .references(() => remplacants.id, { onDelete: 'cascade' }),
  dateDebut: date('date_debut').notNull(),
  dateFin: date('date_fin').notNull(),
  creneau: creneauEnum('creneau').notNull(),
  motif: absenceMotifEnum('motif').notNull(),
  motifDetails: text('motif_details'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('absences_type_idx').on(table.type),
  index('absences_collaborateur_id_idx').on(table.collaborateurId),
  index('absences_remplacant_id_idx').on(table.remplacantId),
  index('absences_date_debut_idx').on(table.dateDebut),
  index('absences_date_fin_idx').on(table.dateFin),
])

// ─── Messages WhatsApp ──────────────────────────────────────
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  absenceId: integer('absence_id')
    .notNull()
    .references(() => absences.id, { onDelete: 'cascade' }),
  remplacantId: integer('remplacant_id')
    .notNull()
    .references(() => remplacants.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(),
  message: text('message').notNull(),
  twilioSid: text('twilio_sid'),
  status: whatsappMessageStatusEnum('status').notNull().default('sent'),
  response: whatsappResponseEnum('response'),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('whatsapp_messages_absence_id_idx').on(table.absenceId),
  index('whatsapp_messages_remplacant_id_idx').on(table.remplacantId),
  index('whatsapp_messages_phone_idx').on(table.phone),
  index('whatsapp_messages_twilio_sid_idx').on(table.twilioSid),
])

// ─── Types ───────────────────────────────────────────────────
export type Absence = typeof absences.$inferSelect
export type NewAbsence = typeof absences.$inferInsert
export type WhatsappMessage = typeof whatsappMessages.$inferSelect
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert
