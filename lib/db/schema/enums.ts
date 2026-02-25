import { pgEnum } from 'drizzle-orm/pg-core'

// User roles
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'collaborateur', 'remplacant'])

// Log types
export const logTypeEnum = pgEnum('log_type', ['USER_ACTION', 'SYSTEM_EVENT', 'API_CALL'])

// Log priority
export const logPriorityEnum = pgEnum('log_priority', ['info', 'warning', 'error', 'critical'])

// Contrat type
export const contratTypeEnum = pgEnum('contrat_type', ['CDI', 'CDD', 'Mixte'])

// Sexe
export const sexeEnum = pgEnum('sexe', ['M', 'F'])

// Jours de la semaine (pour disponibilités récurrentes)
export const jourSemaineEnum = pgEnum('jour_semaine', ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'])

// Créneaux (matin, après-midi, journée entière)
export const creneauEnum = pgEnum('creneau', ['matin', 'apres_midi', 'journee'])

// Type de vacances/jours fériés
export const vacancesTypeEnum = pgEnum('vacances_type', ['vacances', 'ferie'])

// Type d'absence (collaborateur ou remplaçant)
export const absenceTypeEnum = pgEnum('absence_type', ['collaborateur', 'remplacant'])

// Motif d'absence
export const absenceMotifEnum = pgEnum('absence_motif', ['maladie', 'conge', 'formation', 'autre'])

// Statut message WhatsApp
export const whatsappMessageStatusEnum = pgEnum('whatsapp_message_status', ['sent', 'delivered', 'read', 'failed'])

// Réponse WhatsApp
export const whatsappResponseEnum = pgEnum('whatsapp_response', ['disponible', 'pas_disponible'])

// Type d'observateur (pour séances d'observation)
export const observateurTypeEnum = pgEnum('observateur_type', ['remplacant', 'collaborateur'])
