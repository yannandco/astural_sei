// Système d'urgence pour les remplacements d'absences
// Utilise le champ ecoles.remplacementApresJours pour calculer la priorité

export type UrgencyLevel = 'urgent' | 'warning' | 'normal' | 'no_deadline' | 'replaced'

export interface EcoleUrgency {
  ecoleId: number
  ecoleName: string
  remplacementApresJours: number | string | null
  isRemplacee: boolean
  urgency: UrgencyLevel
  joursRestants: number | null
}

export interface OverallUrgency {
  urgency: UrgencyLevel
  joursRestants: number | null
}

const URGENCY_PRIORITY: Record<UrgencyLevel, number> = {
  urgent: 0,
  warning: 1,
  normal: 2,
  no_deadline: 3,
  replaced: 4,
}

export function computeEcoleUrgency(
  dateDebut: string,
  remplacementApresJours: number | string | null,
  isRemplacee: boolean,
  today?: string,
): { urgency: UrgencyLevel; joursRestants: number | null } {
  if (isRemplacee) {
    return { urgency: 'replaced', joursRestants: null }
  }

  const jours = remplacementApresJours != null ? Number(remplacementApresJours) : null
  if (jours == null || isNaN(jours)) {
    return { urgency: 'no_deadline', joursRestants: null }
  }

  const todayStr = today || new Date().toISOString().split('T')[0]

  // deadline = dateDebut + jours
  const debut = new Date(dateDebut + 'T00:00:00')
  debut.setDate(debut.getDate() + Math.ceil(jours))
  const deadlineStr = debut.toISOString().split('T')[0]

  // joursRestants = deadline - aujourd'hui (en jours)
  const deadlineDate = new Date(deadlineStr + 'T00:00:00')
  const todayDate = new Date(todayStr + 'T00:00:00')
  const diffMs = deadlineDate.getTime() - todayDate.getTime()
  const joursRestants = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (joursRestants < 0) {
    return { urgency: 'urgent', joursRestants }
  }
  if (joursRestants <= 1) {
    return { urgency: 'warning', joursRestants }
  }
  return { urgency: 'normal', joursRestants }
}

export function computeOverallUrgency(ecoleUrgencies: EcoleUrgency[]): OverallUrgency {
  if (ecoleUrgencies.length === 0) {
    return { urgency: 'no_deadline', joursRestants: null }
  }

  // Trouver la pire urgence
  let worst: EcoleUrgency = ecoleUrgencies[0]
  for (const eu of ecoleUrgencies) {
    if (URGENCY_PRIORITY[eu.urgency] < URGENCY_PRIORITY[worst.urgency]) {
      worst = eu
    } else if (
      URGENCY_PRIORITY[eu.urgency] === URGENCY_PRIORITY[worst.urgency] &&
      eu.joursRestants !== null &&
      (worst.joursRestants === null || eu.joursRestants < worst.joursRestants)
    ) {
      worst = eu
    }
  }

  return { urgency: worst.urgency, joursRestants: worst.joursRestants }
}

export function getUrgencySortValue(urgency: UrgencyLevel, joursRestants: number | null): number {
  // Lower = more urgent (for ascending sort)
  const base = URGENCY_PRIORITY[urgency] * 1000
  if (joursRestants !== null) {
    return base + joursRestants
  }
  return base + 999
}
