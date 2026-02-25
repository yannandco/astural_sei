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
  | 'disponible_specifique'  // Vert - disponibilité marquée
  | 'indisponible_exception' // Rouge - exception (indisponible explicitement)
  | 'affecte'                // Violet - affecté à un collaborateur
  | 'absent_non_remplace'    // Rouge - absent, pas encore couvert
  | 'absent_remplace'        // Orange atténué - absent mais couvert par un remplaçant

export type UrgencyLevel = 'urgent' | 'warning' | 'normal' | 'no_deadline' | 'replaced'

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
  urgency?: UrgencyLevel
  joursRestants?: number | null
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

  // Par défaut: indisponible
  return { status: 'indisponible' }
}
