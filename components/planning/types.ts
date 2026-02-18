// Types partagés pour le module planning

export type JourSemaine = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi'
export type Creneau = 'matin' | 'apres_midi' | 'journee'

export const JOURS_SEMAINE: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']
// Jours affichés dans les calendriers (sans mercredi)
export const JOURS_CALENDRIER: JourSemaine[] = ['lundi', 'mardi', 'jeudi', 'vendredi']
export const CRENEAUX: Creneau[] = ['matin', 'apres_midi', 'journee']

export const JOUR_LABELS: Record<JourSemaine, string> = {
  lundi: 'Lun',
  mardi: 'Mar',
  mercredi: 'Mer',
  jeudi: 'Jeu',
  vendredi: 'Ven',
}

export const JOUR_FULL_LABELS: Record<JourSemaine, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
}

export const CRENEAU_LABELS: Record<Creneau, string> = {
  matin: 'Matin',
  apres_midi: 'Après-midi',
  journee: 'Journée',
}

// Période de disponibilité récurrente
export interface DisponibilitePeriode {
  id: number
  remplacantId: number
  nom: string | null
  dateDebut: string
  dateFin: string
  isActive: boolean
  recurrences: DisponibiliteRecurrente[]
}

// Disponibilité récurrente (pattern hebdomadaire dans une période)
export interface DisponibiliteRecurrente {
  id: number
  periodeId: number
  jourSemaine: JourSemaine
  creneau: Creneau
  periodeNom?: string | null
  periodeDebut?: string
  periodeFin?: string
}

// Disponibilité spécifique (date ponctuelle)
export interface DisponibiliteSpecifique {
  id: number
  remplacantId: number
  date: string
  creneau: Creneau
  isAvailable: boolean
  note: string | null
}

// Affectation (remplaçant assigné à un collaborateur)
export interface Affectation {
  id: number
  remplacantId: number
  collaborateurId: number
  collaborateurNom: string | null
  collaborateurPrenom: string | null
  ecoleId: number
  ecoleNom: string | null
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string | null
}

// Vacances scolaires
export interface VacancesScolaires {
  id: number
  annee: number
  type: 'vacances' | 'ferie'
  nom: string
  dateDebut: string
  dateFin: string
}

// État d'une cellule du calendrier
export type CellStatus =
  | 'indisponible'           // Gris - par défaut, pas de disponibilité
  | 'disponible_recurrent'   // Vert clair - disponibilité récurrente
  | 'disponible_specifique'  // Vert foncé - disponibilité ponctuelle ajoutée
  | 'indisponible_exception' // Rouge - exception (indisponible alors que normalement dispo)
  | 'affecte'                // Violet - affecté à un collaborateur
  | 'absent_non_remplace'    // Rouge - absent, pas encore couvert
  | 'absent_remplace'        // Orange atténué - absent mais couvert par un remplaçant

// Absence (collaborateur ou remplaçant)
export interface AbsenceData {
  id: number
  type: 'collaborateur' | 'remplacant'
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string
  motifDetails: string | null
  isRemplacee?: boolean
}

export const MOTIF_LABELS: Record<string, string> = {
  maladie: 'Maladie',
  conge: 'Congé',
  formation: 'Formation',
  autre: 'Autre',
}

export interface CellData {
  date: string
  creneau: Creneau
  status: CellStatus
  affectation?: Affectation
  specifique?: DisponibiliteSpecifique
  absence?: AbsenceData
  isVacances?: boolean
  vacancesNom?: string
}

// Helper pour obtenir le jour de la semaine d'une date
export function getJourSemaine(date: Date): JourSemaine | null {
  const day = date.getDay()
  const map: Record<number, JourSemaine> = {
    1: 'lundi',
    2: 'mardi',
    3: 'mercredi',
    4: 'jeudi',
    5: 'vendredi',
  }
  return map[day] || null
}

// Helper pour formater une date en YYYY-MM-DD
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper pour obtenir les dates d'une semaine (Lu, Ma, Je, Ve - sans mercredi)
export function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = []
  const current = new Date(startDate)

  // Aller au lundi de la semaine
  const day = current.getDay()
  const diff = day === 0 ? -6 : 1 - day
  current.setDate(current.getDate() + diff)

  // Générer Lu, Ma, Je, Ve (skip mercredi)
  for (let i = 0; i < 5; i++) {
    if (i !== 2) { // Skip mercredi (index 2)
      dates.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }

  return dates
}

// Helper pour calculer le statut d'une cellule
export function calculateCellStatus(
  date: string,
  creneau: Creneau,
  recurrentes: DisponibiliteRecurrente[],
  specifiques: DisponibiliteSpecifique[],
  affectations: Affectation[],
  absencesData?: AbsenceData[],
): { status: CellStatus; affectation?: Affectation; specifique?: DisponibiliteSpecifique; absence?: AbsenceData } {
  // Priorité 0: Vérifier les absences (priorité maximale)
  if (absencesData) {
    const absence = absencesData.find(a => {
      const isInDateRange = date >= a.dateDebut && date <= a.dateFin
      const isMatchingCreneau = a.creneau === creneau || a.creneau === 'journee' || creneau === 'journee'
      return isInDateRange && isMatchingCreneau
    })

    if (absence) {
      return {
        status: absence.isRemplacee ? 'absent_remplace' : 'absent_non_remplace',
        absence,
      }
    }
  }

  // Priorité 1: Vérifier les affectations
  const affectation = affectations.find(a => {
    const isInDateRange = date >= a.dateDebut && date <= a.dateFin
    const isMatchingCreneau = a.creneau === creneau || a.creneau === 'journee' || creneau === 'journee'
    return isInDateRange && isMatchingCreneau
  })

  if (affectation) {
    return { status: 'affecte', affectation }
  }

  // Priorité 2: Vérifier les disponibilités spécifiques
  const specifique = specifiques.find(s =>
    s.date === date && (s.creneau === creneau || s.creneau === 'journee' || creneau === 'journee')
  )

  if (specifique) {
    return {
      status: specifique.isAvailable ? 'disponible_specifique' : 'indisponible_exception',
      specifique,
    }
  }

  // Priorité 3: Vérifier les disponibilités récurrentes (avec période)
  const dateObj = new Date(date)
  const jourSemaine = getJourSemaine(dateObj)

  if (jourSemaine) {
    // Filtrer les récurrences qui sont dans une période active pour cette date
    const recurrente = recurrentes.find(r => {
      // Vérifier que la récurrence correspond au jour et créneau
      const matchesJourCreneau = r.jourSemaine === jourSemaine &&
        (r.creneau === creneau || r.creneau === 'journee' || creneau === 'journee')

      if (!matchesJourCreneau) return false

      // Vérifier que la date est dans la période (si les infos de période sont disponibles)
      if (r.periodeDebut && r.periodeFin) {
        return date >= r.periodeDebut && date <= r.periodeFin
      }

      return true // Si pas d'info de période, considérer comme valide
    })

    if (recurrente) {
      return { status: 'disponible_recurrent' }
    }
  }

  // Par défaut: indisponible
  return { status: 'indisponible' }
}

// Helper pour calculer le statut avec des périodes complètes
export function calculateCellStatusWithPeriodes(
  date: string,
  creneau: Creneau,
  periodes: DisponibilitePeriode[],
  specifiques: DisponibiliteSpecifique[],
  affectations: Affectation[],
  absencesData?: AbsenceData[],
): { status: CellStatus; affectation?: Affectation; specifique?: DisponibiliteSpecifique; absence?: AbsenceData } {
  // Extraire toutes les récurrences des périodes actives pour cette date
  const recurrentes: DisponibiliteRecurrente[] = []

  for (const periode of periodes) {
    if (!periode.isActive) continue
    if (date < periode.dateDebut || date > periode.dateFin) continue

    for (const rec of periode.recurrences) {
      recurrentes.push({
        ...rec,
        periodeDebut: periode.dateDebut,
        periodeFin: periode.dateFin,
      })
    }
  }

  return calculateCellStatus(date, creneau, recurrentes, specifiques, affectations, absencesData)
}
