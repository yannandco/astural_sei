import { pgTable, integer, uuid, text, boolean, timestamp, date, index, unique } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { collaborateurs } from './collaborateurs'
import { remplacants } from './remplacants'
import { ecoles } from './etablissements'
import { jourSemaineEnum, creneauEnum, vacancesTypeEnum } from './enums'

// ─── Périodes de disponibilité récurrente ───────────────────
// Chaque période définit une plage de dates pendant laquelle
// le remplaçant est disponible selon un pattern hebdomadaire

export const remplacantDisponibilitesPeriodes = pgTable('remplacant_disponibilites_periodes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  remplacantId: integer('remplacant_id')
    .notNull()
    .references(() => remplacants.id, { onDelete: 'cascade' }),
  nom: text('nom'), // Ex: "Semestre 1 2025-2026"
  dateDebut: date('date_debut').notNull(),
  dateFin: date('date_fin').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('remplacant_dispo_periode_remplacant_id_idx').on(table.remplacantId),
  index('remplacant_dispo_periode_dates_idx').on(table.dateDebut, table.dateFin),
])

// ─── Disponibilités récurrentes (pattern hebdomadaire) ──────
// Liées à une période spécifique

export const remplacantDisponibilitesRecurrentes = pgTable('remplacant_disponibilites_recurrentes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  periodeId: integer('periode_id')
    .notNull()
    .references(() => remplacantDisponibilitesPeriodes.id, { onDelete: 'cascade' }),
  jourSemaine: jourSemaineEnum('jour_semaine').notNull(),
  creneau: creneauEnum('creneau').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('remplacant_dispo_recur_periode_id_idx').on(table.periodeId),
  // Unicité: un seul enregistrement par période/jour/créneau
  unique('remplacant_dispo_recur_unique').on(table.periodeId, table.jourSemaine, table.creneau),
])

// ─── Disponibilités spécifiques (dates ponctuelles) ─────────

export const remplacantDisponibilitesSpecifiques = pgTable('remplacant_disponibilites_specifiques', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  remplacantId: integer('remplacant_id')
    .notNull()
    .references(() => remplacants.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  creneau: creneauEnum('creneau').notNull(),
  // true = disponible (ajout ponctuel), false = indisponible (exception)
  isAvailable: boolean('is_available').notNull(),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('remplacant_dispo_spec_remplacant_id_idx').on(table.remplacantId),
  index('remplacant_dispo_spec_date_idx').on(table.date),
  // Unicité: un seul enregistrement par remplaçant/date/créneau
  unique('remplacant_dispo_spec_unique').on(table.remplacantId, table.date, table.creneau),
])

// ─── Affectations (remplaçant assigné à un collaborateur) ───

export const remplacantAffectations = pgTable('remplacant_affectations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  remplacantId: integer('remplacant_id')
    .notNull()
    .references(() => remplacants.id, { onDelete: 'cascade' }),
  collaborateurId: integer('collaborateur_id')
    .notNull()
    .references(() => collaborateurs.id, { onDelete: 'cascade' }),
  ecoleId: integer('ecole_id')
    .notNull()
    .references(() => ecoles.id, { onDelete: 'cascade' }),
  dateDebut: date('date_debut').notNull(),
  dateFin: date('date_fin').notNull(),
  creneau: creneauEnum('creneau').notNull(),
  motif: text('motif'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('remplacant_affect_remplacant_id_idx').on(table.remplacantId),
  index('remplacant_affect_collaborateur_id_idx').on(table.collaborateurId),
  index('remplacant_affect_ecole_id_idx').on(table.ecoleId),
  index('remplacant_affect_date_debut_idx').on(table.dateDebut),
  index('remplacant_affect_date_fin_idx').on(table.dateFin),
])

// ─── Cache vacances scolaires (OpenHolidays API) ────────────

export const vacancesScolairesCache = pgTable('vacances_scolaires_cache', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  annee: integer('annee').notNull(),
  type: vacancesTypeEnum('type').notNull(),
  nom: text('nom').notNull(),
  dateDebut: date('date_debut').notNull(),
  dateFin: date('date_fin').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('vacances_cache_annee_idx').on(table.annee),
  index('vacances_cache_date_debut_idx').on(table.dateDebut),
  index('vacances_cache_date_fin_idx').on(table.dateFin),
  // Unicité: une seule entrée par nom/date de début
  unique('vacances_cache_unique').on(table.nom, table.dateDebut),
])

// ─── Types ───────────────────────────────────────────────────

export type RemplacantDisponibilitePeriode = typeof remplacantDisponibilitesPeriodes.$inferSelect
export type NewRemplacantDisponibilitePeriode = typeof remplacantDisponibilitesPeriodes.$inferInsert
export type RemplacantDisponibiliteRecurrente = typeof remplacantDisponibilitesRecurrentes.$inferSelect
export type NewRemplacantDisponibiliteRecurrente = typeof remplacantDisponibilitesRecurrentes.$inferInsert
export type RemplacantDisponibiliteSpecifique = typeof remplacantDisponibilitesSpecifiques.$inferSelect
export type NewRemplacantDisponibiliteSpecifique = typeof remplacantDisponibilitesSpecifiques.$inferInsert
export type RemplacantAffectation = typeof remplacantAffectations.$inferSelect
export type NewRemplacantAffectation = typeof remplacantAffectations.$inferInsert
export type VacancesScolairesCache = typeof vacancesScolairesCache.$inferSelect
export type NewVacancesScolairesCache = typeof vacancesScolairesCache.$inferInsert
