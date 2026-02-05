import { pgTable, integer, uuid, varchar, text, boolean, timestamp, date, decimal, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { collaborateurs } from './collaborateurs'

// ─── Périodes Scolaires ────────────────────────────────────────

export const periodesScolaires = pgTable('periodes_scolaires', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', { length: 10 }).notNull().unique(),  // "R25", "R26"
  label: varchar('label', { length: 50 }).notNull(),  // "Rentrée 2025-2026"
  dateDebut: date('date_debut').notNull(),  // "2025-08-01"
  dateFin: date('date_fin').notNull(),  // "2026-07-31"
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('periodes_scolaires_code_idx').on(table.code),
])

// ─── Établissements ──────────────────────────────────────────

export const etablissements = pgTable('etablissements', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  directeurId: integer('directeur_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('etablissements_name_idx').on(table.name),
  index('etablissements_is_active_idx').on(table.isActive),
  index('etablissements_directeur_id_idx').on(table.directeurId),
])

// ─── Directeurs ──────────────────────────────────────────────

export const directeurs = pgTable('directeurs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('directeurs_last_name_idx').on(table.lastName),
  index('directeurs_is_active_idx').on(table.isActive),
])

// ─── Écoles ──────────────────────────────────────────────────

export const ecoles = pgTable('ecoles', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 200 }).notNull(),
  etablissementId: integer('etablissement_id')
    .notNull()
    .references(() => etablissements.id, { onDelete: 'cascade' }),
  directeurId: integer('directeur_id')
    .references(() => directeurs.id, { onDelete: 'set null' }),
  address: text('address'),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  remplacementApresJours: integer('remplacement_apres_jours'),
  commentaires: text('commentaires'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('ecoles_etablissement_id_idx').on(table.etablissementId),
  index('ecoles_directeur_id_idx').on(table.directeurId),
  index('ecoles_name_idx').on(table.name),
  index('ecoles_is_active_idx').on(table.isActive),
])

// ─── Classes ─────────────────────────────────────────────────

export const classes = pgTable('classes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 100 }).notNull(),
  ecoleId: integer('ecole_id')
    .notNull()
    .references(() => ecoles.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('classes_ecole_id_idx').on(table.ecoleId),
])

// ─── Titulaires ──────────────────────────────────────────────

export const titulaires = pgTable('titulaires', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('titulaires_last_name_idx').on(table.lastName),
  index('titulaires_is_active_idx').on(table.isActive),
])

// ─── Tables de liaison ──────────────────────────────────────

export const collaborateurEcoles = pgTable('collaborateur_ecoles', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  collaborateurId: integer('collaborateur_id')
    .notNull()
    .references(() => collaborateurs.id, { onDelete: 'cascade' }),
  ecoleId: integer('ecole_id')
    .notNull()
    .references(() => ecoles.id, { onDelete: 'cascade' }),
  classeId: integer('classe_id')
    .references(() => classes.id, { onDelete: 'set null' }),
  periodeId: integer('periode_id')
    .references(() => periodesScolaires.id, { onDelete: 'set null' }),
  remplacePourCollaborateurId: integer('remplace_pour_collaborateur_id')
    .references(() => collaborateurs.id, { onDelete: 'set null' }),
  dateDebut: date('date_debut'),
  dateFin: date('date_fin'),
  joursPresence: text('jours_presence'),  // JSON: [{jour, creneau}, ...]
  tauxCoIntervention: decimal('taux_co_intervention', { precision: 5, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('collaborateur_ecoles_collaborateur_id_idx').on(table.collaborateurId),
  index('collaborateur_ecoles_ecole_id_idx').on(table.ecoleId),
  index('collaborateur_ecoles_periode_id_idx').on(table.periodeId),
])

export const titulaireAffectations = pgTable('titulaire_affectations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  titulaireId: integer('titulaire_id')
    .notNull()
    .references(() => titulaires.id, { onDelete: 'cascade' }),
  ecoleId: integer('ecole_id')
    .notNull()
    .references(() => ecoles.id, { onDelete: 'cascade' }),
  classeId: integer('classe_id')
    .references(() => classes.id, { onDelete: 'set null' }),
  periodeId: integer('periode_id')
    .references(() => periodesScolaires.id, { onDelete: 'set null' }),
  dateDebut: date('date_debut'),
  dateFin: date('date_fin'),
  joursPresence: text('jours_presence'),  // JSON: [{jour, creneau}, ...]
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('titulaire_affectations_titulaire_id_idx').on(table.titulaireId),
  index('titulaire_affectations_ecole_id_idx').on(table.ecoleId),
  index('titulaire_affectations_periode_id_idx').on(table.periodeId),
])

// ─── Tables d'historique de remplacements ────────────────────

export const directeurRemplacements = pgTable('directeur_remplacements', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  ecoleId: integer('ecole_id')
    .notNull()
    .references(() => ecoles.id, { onDelete: 'cascade' }),
  directeurOriginalId: integer('directeur_original_id')
    .notNull()
    .references(() => directeurs.id, { onDelete: 'cascade' }),
  remplacantDirecteurId: integer('remplacant_directeur_id')
    .notNull()
    .references(() => directeurs.id, { onDelete: 'cascade' }),
  dateDebut: date('date_debut').notNull(),
  dateFin: date('date_fin'),
  motif: text('motif'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('directeur_remplacements_ecole_id_idx').on(table.ecoleId),
  index('directeur_remplacements_original_id_idx').on(table.directeurOriginalId),
])

export const titulaireRemplacements = pgTable('titulaire_remplacements', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  affectationId: integer('affectation_id')
    .notNull()
    .references(() => titulaireAffectations.id, { onDelete: 'cascade' }),
  titulaireOriginalId: integer('titulaire_original_id')
    .notNull()
    .references(() => titulaires.id, { onDelete: 'cascade' }),
  remplacantTitulaireId: integer('remplacant_titulaire_id')
    .notNull()
    .references(() => titulaires.id, { onDelete: 'cascade' }),
  dateDebut: date('date_debut').notNull(),
  dateFin: date('date_fin'),
  motif: text('motif'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('titulaire_remplacements_affectation_id_idx').on(table.affectationId),
  index('titulaire_remplacements_original_id_idx').on(table.titulaireOriginalId),
])

// ─── École Taux (par période) ─────────────────────────────────

export const ecoleTaux = pgTable('ecole_taux', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  ecoleId: integer('ecole_id')
    .notNull()
    .references(() => ecoles.id, { onDelete: 'cascade' }),
  periodeId: integer('periode_id')
    .notNull()
    .references(() => periodesScolaires.id, { onDelete: 'cascade' }),
  tauxEngagement: decimal('taux_engagement', { precision: 5, scale: 2 }),
  tauxCoIntervention: decimal('taux_co_intervention', { precision: 5, scale: 2 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('ecole_taux_ecole_id_idx').on(table.ecoleId),
  uniqueIndex('ecole_taux_ecole_periode_idx').on(table.ecoleId, table.periodeId),
])

// ─── Types ───────────────────────────────────────────────────

export type PeriodeScolaire = typeof periodesScolaires.$inferSelect
export type NewPeriodeScolaire = typeof periodesScolaires.$inferInsert
export type Etablissement = typeof etablissements.$inferSelect
export type NewEtablissement = typeof etablissements.$inferInsert
export type Ecole = typeof ecoles.$inferSelect
export type NewEcole = typeof ecoles.$inferInsert
export type Classe = typeof classes.$inferSelect
export type NewClasse = typeof classes.$inferInsert
export type Directeur = typeof directeurs.$inferSelect
export type NewDirecteur = typeof directeurs.$inferInsert
export type Titulaire = typeof titulaires.$inferSelect
export type NewTitulaire = typeof titulaires.$inferInsert
export type CollaborateurEcole = typeof collaborateurEcoles.$inferSelect
export type NewCollaborateurEcole = typeof collaborateurEcoles.$inferInsert
export type TitulaireAffectation = typeof titulaireAffectations.$inferSelect
export type NewTitulaireAffectation = typeof titulaireAffectations.$inferInsert
export type DirecteurRemplacement = typeof directeurRemplacements.$inferSelect
export type TitulaireRemplacement = typeof titulaireRemplacements.$inferSelect
export type EcoleTaux = typeof ecoleTaux.$inferSelect
export type NewEcoleTaux = typeof ecoleTaux.$inferInsert
