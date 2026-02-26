'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDaysIcon,
  ArrowLeftIcon,
  TrashIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  MagnifyingGlassCircleIcon,
} from '@heroicons/react/24/outline'
import {
  CollaborateurMonthCalendar,
  AbsenceModal,
  ReplacementModal,
  type AbsenceData,
  type VacancesScolaires,
  type Creneau,
  type JourSemaine,
  type DisponibiliteSpecifique,
  type Affectation,
  formatDate as planningFormatDate,
  getJourSemaine,
  calculateCellStatus,
  JOUR_LABELS,
  CRENEAU_LABELS as PLANNING_CRENEAU_LABELS,
} from '@/components/planning'
import type { SelectedCell } from '@/components/planning/CollaborateurMonthCalendar'
import AssignRemplacantModal from '@/components/modals/AssignRemplacantModal'
import WhatsAppSearchModal from '@/components/modals/WhatsAppSearchModal'

// ─── Types ────────────────────────────────────────────────────

type UrgencyLevel = 'urgent' | 'warning' | 'normal' | 'no_deadline' | 'replaced'

interface AbsenceEcole {
  id: number
  name: string
  joursPresence: string | null
  remplacementApresJours: number | null
  isRemplacee: boolean
  urgency: UrgencyLevel
  joursRestants: number | null
}

interface WhatsappDisponible {
  remplacantId: number
  nom: string | null
  prenom: string | null
}

interface AbsenceRow {
  id: number
  type: 'collaborateur' | 'remplacant'
  collaborateurId: number | null
  remplacantId: number | null
  personId: number | null
  personFirstName: string | null
  personLastName: string | null
  dateDebut: string
  dateFin: string
  creneau: 'matin' | 'apres_midi' | 'journee'
  motif: 'maladie' | 'conge' | 'formation' | 'autre'
  motifDetails: string | null
  isActive: boolean
  isRemplacee: boolean
  replacementStatus: 'none' | 'partial' | 'full'
  remplacementRemplacantId: number | null
  remplacementRemplacantNom: string | null
  remplacementRemplacantPrenom: string | null
  collaborateurEcoles: AbsenceEcole[]
  urgency: UrgencyLevel
  joursRestants: number | null
  whatsappSent: number
  whatsappDisponible: WhatsappDisponible[]
  whatsappPasDisponible: number
  whatsappEnAttente: number
}

interface RemplacantOption {
  id: number
  lastName: string
  firstName: string
  phone?: string | null
  email?: string | null
}

interface WhatsappResponseRow {
  id: number
  remplacantId: number
  phone: string
  status: string
  response: 'disponible' | 'pas_disponible' | null
  respondedAt: string | null
  createdAt: string
  remplacantFirstName: string | null
  remplacantLastName: string | null
}

interface PlanningPresence {
  ecoleId: number
  ecoleName: string
  joursPresence: { jour: JourSemaine; creneau: Creneau }[]
}

interface PlanningRemplacement {
  id: number
  remplacantId: number
  remplacantNom: string | null
  remplacantPrenom: string | null
  ecoleId: number
  ecoleNom: string | null
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string | null
}

interface ReplacementEntry {
  date: string
  jour: JourSemaine
  creneau: Creneau
  ecoleId: number
  ecoleName: string
}

interface PlanningRemplacantData {
  id: number
  lastName: string
  firstName: string
  specifiques: DisponibiliteSpecifique[]
  affectations: Affectation[]
}

// ─── Constants ────────────────────────────────────────────────

const MOTIF_LABELS: Record<string, string> = {
  maladie: 'Maladie',
  conge: 'Congé',
  formation: 'Formation',
  autre: 'Autre',
}

const CRENEAU_LABELS: Record<string, string> = {
  matin: 'Matin',
  apres_midi: 'Après-midi',
  journee: 'Journée',
}

const TYPE_LABELS: Record<string, string> = {
  collaborateur: 'Collaborateur',
  remplacant: 'Remplaçant',
}

// ─── Component ────────────────────────────────────────────────

export default function AbsenceDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  // Main data
  const [absence, setAbsence] = useState<AbsenceRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Available remplaçants sidebar
  const [availableRemplacants, setAvailableRemplacants] = useState<RemplacantOption[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [selectedSidebarRemplacantId, setSelectedSidebarRemplacantId] = useState<number | null>(null)
  const [remplacantPlanningData, setRemplacantPlanningData] = useState<PlanningRemplacantData[]>([])
  const [loadingRemplacantPlanning, setLoadingRemplacantPlanning] = useState(false)

  // Planning calendar (collaborateur only)
  const [planningPresences, setPlanningPresences] = useState<PlanningPresence[]>([])
  const [planningRemplacements, setPlanningRemplacements] = useState<PlanningRemplacement[]>([])
  const [planningAbsences, setPlanningAbsences] = useState<AbsenceData[]>([])
  const [planningVacances, setPlanningVacances] = useState<VacancesScolaires[]>([])

  // WhatsApp responses
  const [responses, setResponses] = useState<WhatsappResponseRow[]>([])
  const [loadingResponses, setLoadingResponses] = useState(false)

  // Assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningRemplacant, setAssigningRemplacant] = useState<RemplacantOption | null>(null)
  const [assigningLoading, setAssigningLoading] = useState(false)

  // Search WhatsApp modal
  const [showSearchModal, setShowSearchModal] = useState(false)

  // Interactive calendar modals
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<AbsenceData | null>(null)
  const [showReplacementModal, setShowReplacementModal] = useState(false)
  const [editingRemplacement, setEditingRemplacement] = useState<PlanningRemplacement | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillDateFin, setPrefillDateFin] = useState<string | null>(null)
  const [prefillCreneau, setPrefillCreneau] = useState<Creneau | null>(null)
  const [replacementSkipMotif, setReplacementSkipMotif] = useState(false)

  // ─── Fetch absence ───────────────────────────────────────────

  const fetchAbsence = useCallback(async () => {
    try {
      const res = await fetch(`/api/absences/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Absence non trouvée')
        } else {
          setError('Erreur lors du chargement')
        }
        return
      }
      const data = await res.json()
      setAbsence(data.data)
    } catch {
      setError('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAbsence()
  }, [fetchAbsence])

  // Fetch available remplaçants when absence loads (collaborateur type only)
  useEffect(() => {
    if (!absence || absence.type !== 'collaborateur') return

    const fetchAvailable = async () => {
      setLoadingAvailable(true)
      try {
        const params = new URLSearchParams({
          isActive: 'true',
          availableFrom: absence.dateDebut,
          availableTo: absence.dateFin,
        })
        const res = await fetch(`/api/remplacants?${params.toString()}`)
        const data = await res.json()
        setAvailableRemplacants(
          (data.data || []).map((r: RemplacantOption) => ({
            id: r.id,
            lastName: r.lastName,
            firstName: r.firstName,
            phone: r.phone || null,
            email: r.email || null,
          }))
        )
      } catch (err) {
        console.error('Error fetching available remplacants:', err)
      } finally {
        setLoadingAvailable(false)
      }
    }

    fetchAvailable()
  }, [absence?.dateDebut, absence?.dateFin, absence?.type])

  // Fetch WhatsApp responses
  useEffect(() => {
    if (!absence || absence.whatsappSent === 0) return

    const fetchResponses = async () => {
      setLoadingResponses(true)
      try {
        const res = await fetch(`/api/whatsapp/responses?absenceId=${absence.id}`)
        const data = await res.json()
        setResponses(data.data || [])
      } catch (err) {
        console.error('Error fetching responses:', err)
      } finally {
        setLoadingResponses(false)
      }
    }

    fetchResponses()
  }, [absence?.id, absence?.whatsappSent])

  // Fetch planning data for collaborateur calendar
  const fetchPlanningData = useCallback(async () => {
    if (!absence || absence.type !== 'collaborateur' || !absence.collaborateurId) return

    try {
      const absDate = new Date(absence.dateDebut + 'T00:00:00')
      const startDate = new Date(absDate.getFullYear(), absDate.getMonth() - 1, 1)
      const endDate = new Date(absDate.getFullYear(), absDate.getMonth() + 2, 0)
      const startDateStr = planningFormatDate(startDate)
      const endDateStr = planningFormatDate(endDate)

      const [planRes, absRes, vacRes] = await Promise.all([
        fetch(`/api/collaborateurs/${absence.collaborateurId}/planning?startDate=${startDateStr}&endDate=${endDateStr}`),
        fetch(`/api/collaborateurs/${absence.collaborateurId}/absences?startDate=${startDateStr}&endDate=${endDateStr}`),
        fetch(`/api/vacances-scolaires?startDate=${startDateStr}&endDate=${endDateStr}`),
      ])

      if (planRes.ok) {
        const { data } = await planRes.json()
        setPlanningPresences(data?.presences || [])
        setPlanningRemplacements(data?.remplacements || [])
      }
      if (absRes.ok) {
        const { data } = await absRes.json()
        setPlanningAbsences(data || [])
      }
      if (vacRes.ok) {
        const { data } = await vacRes.json()
        setPlanningVacances(data || [])
      }
    } catch (err) {
      console.error('Error fetching planning data:', err)
    }
  }, [absence])

  useEffect(() => {
    fetchPlanningData()
  }, [fetchPlanningData])

  // ─── Helpers ─────────────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredSidebarRemplacantsBase = useMemo(() => {
    if (!sidebarSearch.trim()) return availableRemplacants
    const q = sidebarSearch.toLowerCase()
    return availableRemplacants.filter(
      (r) => r.lastName.toLowerCase().includes(q) || r.firstName.toLowerCase().includes(q)
    )
  }, [availableRemplacants, sidebarSearch])

  // ─── Créneaux détectés ───────────────────────────────────────

  // Build presenceByJour map from planningPresences
  const presenceByJour = useMemo(() => {
    const map = new Map<JourSemaine, { creneau: Creneau; ecoleId: number; ecoleName: string }[]>()
    for (const p of planningPresences) {
      for (const jp of p.joursPresence) {
        const existing = map.get(jp.jour) || []
        existing.push({ creneau: jp.creneau, ecoleId: p.ecoleId, ecoleName: p.ecoleName })
        map.set(jp.jour, existing)
      }
    }
    return map
  }, [planningPresences])

  // Compute individual entries for the absence period
  const computedEntries = useMemo((): ReplacementEntry[] => {
    if (!absence) return []
    const { dateDebut, dateFin } = absence
    if (!dateDebut || !dateFin || dateDebut > dateFin) return []

    const entries: ReplacementEntry[] = []
    const start = new Date(dateDebut + 'T00:00:00')
    const end = new Date(dateFin + 'T00:00:00')
    const current = new Date(start)

    while (current <= end) {
      const dayOfWeek = current.getDay()
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const jour = getJourSemaine(current)
        if (jour) {
          const presenceSlots = presenceByJour.get(jour) || []
          const dateStr = planningFormatDate(current)

          for (const slot of presenceSlots) {
            if (absence.creneau !== 'journee') {
              if (slot.creneau === 'journee' || slot.creneau === absence.creneau) {
                entries.push({ date: dateStr, jour, creneau: absence.creneau as Creneau, ecoleId: slot.ecoleId, ecoleName: slot.ecoleName })
              }
            } else {
              entries.push({ date: dateStr, jour, creneau: slot.creneau, ecoleId: slot.ecoleId, ecoleName: slot.ecoleName })
            }
          }
        }
      }
      current.setDate(current.getDate() + 1)
    }

    return entries
  }, [absence, presenceByJour])

  // Group entries by jour for display
  const entriesByJour = useMemo(() => {
    const map = new Map<JourSemaine, { creneau: Creneau; ecoleName: string }[]>()
    for (const entry of computedEntries) {
      const existing = map.get(entry.jour) || []
      if (!existing.some(e => e.creneau === entry.creneau && e.ecoleName === entry.ecoleName)) {
        existing.push({ creneau: entry.creneau, ecoleName: entry.ecoleName })
      }
      map.set(entry.jour, existing)
    }
    return map
  }, [computedEntries])

  // Fetch remplaçant planning data for availability
  useEffect(() => {
    if (!absence || absence.type !== 'collaborateur' || computedEntries.length === 0) return

    const fetchRemplacantPlanning = async () => {
      setLoadingRemplacantPlanning(true)
      try {
        const res = await fetch(`/api/planning?startDate=${absence.dateDebut}&endDate=${absence.dateFin}`)
        if (res.ok) {
          const { data } = await res.json()
          setRemplacantPlanningData(data || [])
        }
      } catch (err) {
        console.error('Error fetching remplacant planning:', err)
      } finally {
        setLoadingRemplacantPlanning(false)
      }
    }

    fetchRemplacantPlanning()
  }, [absence?.dateDebut, absence?.dateFin, absence?.type, computedEntries.length])

  // Filter remplacements to only those matching this absence's entries
  const absenceRemplacements = useMemo(() => {
    if (planningRemplacements.length === 0 || computedEntries.length === 0) return []
    return planningRemplacements.filter(r => {
      return computedEntries.some(entry => {
        const inRange = entry.date >= r.dateDebut && entry.date <= r.dateFin
        if (!inRange) return false
        if (r.creneau === 'journee') return true
        if (entry.creneau === 'journee') return r.creneau === 'matin' || r.creneau === 'apres_midi'
        return r.creneau === entry.creneau
      })
    })
  }, [planningRemplacements, computedEntries])

  // Filter out entries already covered by a remplacement
  const unreplacedEntries = useMemo(() => {
    if (absenceRemplacements.length === 0) return computedEntries
    return computedEntries.filter(entry => {
      return !absenceRemplacements.some(r => {
        const inRange = entry.date >= r.dateDebut && entry.date <= r.dateFin
        if (!inRange) return false
        if (r.creneau === 'journee') return true
        if (entry.creneau === 'journee') return false
        return r.creneau === entry.creneau
      })
    })
  }, [computedEntries, absenceRemplacements])

  // Compute availability for all remplaçants (for badges in sidebar) — only unreplaced slots
  const remplacantAvailabilityMap = useMemo(() => {
    if (remplacantPlanningData.length === 0 || unreplacedEntries.length === 0) return new Map<number, { available: number; total: number }>()

    const isAvail = (s: string) => s === 'disponible_specifique'
    const map = new Map<number, { available: number; total: number }>()

    for (const r of remplacantPlanningData) {
      let availableCount = 0
      for (const entry of unreplacedEntries) {
        if (entry.creneau === 'journee') {
          const m = calculateCellStatus(entry.date, 'matin', r.specifiques, r.affectations)
          const a = calculateCellStatus(entry.date, 'apres_midi', r.specifiques, r.affectations)
          if (isAvail(m.status) && isAvail(a.status)) availableCount++
        } else {
          const { status } = calculateCellStatus(entry.date, entry.creneau, r.specifiques, r.affectations)
          if (isAvail(status)) availableCount++
        }
      }
      map.set(r.id, { available: availableCount, total: unreplacedEntries.length })
    }

    return map
  }, [remplacantPlanningData, unreplacedEntries])

  const filteredSidebarRemplacants = useMemo(() => {
    return [...filteredSidebarRemplacantsBase].sort((a, b) => {
      const availA = remplacantAvailabilityMap.get(a.id)
      const availB = remplacantAvailabilityMap.get(b.id)
      const scoreA = !availA ? 0 : availA.available === availA.total ? 2 : availA.available > 0 ? 1 : 0
      const scoreB = !availB ? 0 : availB.available === availB.total ? 2 : availB.available > 0 ? 1 : 0
      if (scoreB !== scoreA) return scoreB - scoreA
      const ratioA = availA ? availA.available / availA.total : 0
      const ratioB = availB ? availB.available / availB.total : 0
      return ratioB - ratioA
    })
  }, [filteredSidebarRemplacantsBase, remplacantAvailabilityMap])

  // Compute slot availability for the selected remplaçant
  const slotAvailability = useMemo(() => {
    if (!selectedSidebarRemplacantId || remplacantPlanningData.length === 0 || unreplacedEntries.length === 0) return null
    const rempl = remplacantPlanningData.find(r => r.id === selectedSidebarRemplacantId)
    if (!rempl) return null

    const map = new Map<string, { available: number; total: number }>()
    const isAvail = (s: string) => s === 'disponible_specifique'

    for (const entry of unreplacedEntries) {
      const key = `${entry.jour}:${entry.creneau}:${entry.ecoleName}`
      const current = map.get(key) || { available: 0, total: 0 }
      current.total++

      if (entry.creneau === 'journee') {
        const m = calculateCellStatus(entry.date, 'matin', rempl.specifiques, rempl.affectations)
        const a = calculateCellStatus(entry.date, 'apres_midi', rempl.specifiques, rempl.affectations)
        if (isAvail(m.status) && isAvail(a.status)) current.available++
      } else {
        const { status } = calculateCellStatus(entry.date, entry.creneau, rempl.specifiques, rempl.affectations)
        if (isAvail(status)) current.available++
      }
      map.set(key, current)
    }
    return map
  }, [selectedSidebarRemplacantId, remplacantPlanningData, unreplacedEntries])

  const jourOrder: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']

  // Set of date:creneau keys for highlighting absence cells on the calendar
  const absenceHighlightCells = useMemo(() => {
    return new Set(computedEntries.flatMap(e =>
      e.creneau === 'journee'
        ? [`${e.date}:matin`, `${e.date}:apres_midi`]
        : [`${e.date}:${e.creneau}`]
    ))
  }, [computedEntries])

  // ─── Delete absence ──────────────────────────────────────────

  const handleDeleteAbsence = async () => {
    if (!absence) return
    if (!confirm('Supprimer cette absence ?')) return

    try {
      const endpoint = absence.type === 'collaborateur'
        ? `/api/collaborateurs/${absence.collaborateurId}/absences?absenceId=${absence.id}`
        : `/api/remplacants/${absence.remplacantId}/absences?absenceId=${absence.id}`
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (res.ok) {
        router.push('/absences')
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (err) {
      console.error('Error deleting absence:', err)
      alert('Erreur lors de la suppression')
    }
  }

  // ─── Assignment handlers ─────────────────────────────────────

  const openAssignModal = (remplacant: RemplacantOption) => {
    if (!absence) return
    setAssigningRemplacant(remplacant)
    setShowAssignModal(true)
  }

  const handleAssignRemplacement = async (remplacantId: number, ecoleId: number) => {
    if (!absence) {
      alert('Veuillez sélectionner une école')
      return
    }

    const ecoleIdNum = ecoleId
    const motif = MOTIF_LABELS[absence.motif] || absence.motif

    // Filter unreplaced entries for the selected école
    const entriesForEcole = unreplacedEntries.filter(e => e.ecoleId === ecoleIdNum)

    // Filter to only entries where the remplaçant is actually available
    const rempl = remplacantPlanningData.find(r => r.id === remplacantId)
    const isAvail = (s: string) => s === 'disponible_specifique'
    const availableEntries = rempl
      ? entriesForEcole.filter(entry => {
          if (entry.creneau === 'journee') {
            const m = calculateCellStatus(entry.date, 'matin', rempl.specifiques, rempl.affectations)
            const a = calculateCellStatus(entry.date, 'apres_midi', rempl.specifiques, rempl.affectations)
            return isAvail(m.status) && isAvail(a.status)
          }
          const { status } = calculateCellStatus(entry.date, entry.creneau, rempl.specifiques, rempl.affectations)
          return isAvail(status)
        })
      : entriesForEcole

    setAssigningLoading(true)
    try {
      if (availableEntries.length > 0) {
        // Create one affectation per créneau entry where remplaçant is available
        const results = await Promise.all(
          availableEntries.map(entry =>
            fetch(`/api/remplacants/${remplacantId}/affectations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                collaborateurId: absence.collaborateurId,
                ecoleId: ecoleIdNum,
                dateDebut: entry.date,
                dateFin: entry.date,
                creneau: entry.creneau,
                motif,
              }),
            })
          )
        )

        const failed = results.filter(r => !r.ok)
        if (failed.length > 0) {
          const { error } = await failed[0].json()
          alert(error || "Erreur lors de l'affectation")
          return
        }
      } else if (entriesForEcole.length > 0) {
        // Remplaçant has no available slots for this école
        alert('Ce remplaçant n\'est disponible sur aucun créneau de cette absence pour cette école')
        return
      } else {
        // Fallback: no planning data, use raw absence dates
        const res = await fetch(`/api/remplacants/${remplacantId}/affectations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collaborateurId: absence.collaborateurId,
            ecoleId: ecoleIdNum,
            dateDebut: absence.dateDebut,
            dateFin: absence.dateFin,
            creneau: absence.creneau,
            motif,
          }),
        })

        if (!res.ok) {
          const { error } = await res.json()
          alert(error || "Erreur lors de l'affectation")
          return
        }
      }

      setShowAssignModal(false)
      setAssigningRemplacant(null)
      await fetchAbsence()
      await fetchPlanningData()
    } catch (err) {
      console.error('Error assigning remplacement:', err)
      alert("Erreur lors de l'affectation")
    } finally {
      setAssigningLoading(false)
    }
  }

  // ─── WhatsApp response handlers ──────────────────────────────

  const handleDeleteResponse = async (messageId: number) => {
    if (!confirm('Supprimer cette réponse WhatsApp ?')) return

    try {
      const res = await fetch(`/api/whatsapp/responses/${messageId}`, { method: 'DELETE' })
      if (res.ok) {
        setResponses(prev => prev.filter(r => r.id !== messageId))
        await fetchAbsence()
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (err) {
      console.error('Error deleting response:', err)
    }
  }

  // ─── Interactive calendar handlers ──────────────────────────

  const handleSaveAbsence = async (data: {
    dateDebut: string
    dateFin: string
    creneau: Creneau
    motif: string
    motifDetails?: string
  }) => {
    if (!absence || !absence.collaborateurId) return
    if (editingAbsence) {
      const res = await fetch(`/api/collaborateurs/${absence.collaborateurId}/absences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absenceId: editingAbsence.id, ...data }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        alert(error || 'Erreur lors de la modification')
        return
      }
    } else {
      const res = await fetch(`/api/collaborateurs/${absence.collaborateurId}/absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const { error } = await res.json()
        alert(error || 'Erreur lors de la création')
        return
      }
    }
    setEditingAbsence(null)
    await fetchAbsence()
    await fetchPlanningData()
  }

  const handleSaveReplacement = async (data: {
    remplacantId: number
    dateDebut: string
    dateFin: string
    entries: { ecoleId: number; date: string; creneau: Creneau }[]
    motif: string
    motifDetails?: string
    skipAbsenceCreation?: boolean
  }) => {
    if (!absence || !absence.collaborateurId) return
    const res = await fetch(`/api/collaborateurs/${absence.collaborateurId}/remplacements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const { error } = await res.json()
      alert(error || 'Erreur lors de la création du remplacement')
      throw new Error(error)
    }
    await fetchAbsence()
    await fetchPlanningData()
  }

  const handleUpdateReplacement = async (data: { affectationId: number; remplacantId: number }) => {
    if (!absence || !absence.collaborateurId) return
    const res = await fetch(`/api/collaborateurs/${absence.collaborateurId}/remplacements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const { error } = await res.json()
      alert(error || 'Erreur lors de la mise à jour')
      throw new Error(error)
    }
    setEditingRemplacement(null)
    await fetchAbsence()
    await fetchPlanningData()
  }

  const handleBatchDeleteAbsences = useCallback(async (cells: SelectedCell[]) => {
    if (!absence || !absence.collaborateurId) return
    const absenceCells = cells.filter(c => c.type === 'absence')
    if (absenceCells.length === 0) return

    const absenceIds = new Set<number>()
    for (const cell of absenceCells) {
      const matching = planningAbsences.find(a => {
        const inRange = cell.date >= a.dateDebut && cell.date <= a.dateFin
        const creneauMatch = a.creneau === cell.creneau || a.creneau === 'journee' || cell.creneau === 'journee'
        return inRange && creneauMatch
      })
      if (matching) absenceIds.add(matching.id)
    }

    if (absenceIds.size === 0) return
    if (!confirm(`Supprimer ${absenceIds.size} absence${absenceIds.size > 1 ? 's' : ''} ?`)) return

    try {
      await Promise.all(
        Array.from(absenceIds).map(absenceId =>
          fetch(`/api/collaborateurs/${absence.collaborateurId}/absences?absenceId=${absenceId}`, { method: 'DELETE' })
        )
      )
      await fetchAbsence()
      await fetchPlanningData()
    } catch (error) {
      console.error('Error batch deleting absences:', error)
    }
  }, [absence, planningAbsences, fetchAbsence, fetchPlanningData])

  const handleBatchDeleteRemplacements = useCallback(async (cells: SelectedCell[]) => {
    if (!absence || !absence.collaborateurId) return
    const replCells = cells.filter(c => c.type === 'remplacement')
    if (replCells.length === 0) return

    const affectationIds = new Set<number>()
    for (const cell of replCells) {
      const matching = planningRemplacements.filter(r => {
        const inRange = cell.date >= r.dateDebut && cell.date <= r.dateFin
        const creneauMatch = r.creneau === cell.creneau || r.creneau === 'journee' || cell.creneau === 'journee'
        return inRange && creneauMatch
      })
      for (const r of matching) affectationIds.add(r.id)
    }

    if (affectationIds.size === 0) return
    if (!confirm(`Supprimer ${affectationIds.size} remplacement${affectationIds.size > 1 ? 's' : ''} ?`)) return

    try {
      await Promise.all(
        Array.from(affectationIds).map(affectationId =>
          fetch(`/api/collaborateurs/${absence.collaborateurId}/remplacements?affectationId=${affectationId}`, { method: 'DELETE' })
        )
      )
      await fetchAbsence()
      await fetchPlanningData()
    } catch (error) {
      console.error('Error batch deleting remplacements:', error)
    }
  }, [absence, planningRemplacements, fetchAbsence, fetchPlanningData])

  const handleSelectionAction = useCallback((
    action: 'absence' | 'remplacement' | 'supprimer_absence' | 'supprimer_remplacement',
    cells: SelectedCell[]
  ) => {
    if (action === 'supprimer_absence') {
      handleBatchDeleteAbsences(cells)
      return
    }
    if (action === 'supprimer_remplacement') {
      handleBatchDeleteRemplacements(cells)
      return
    }

    const dates = cells.map(c => c.date).sort()
    const dateDebut = dates[0]
    const dateFin = dates[dates.length - 1]
    const creneaux = new Set(cells.map(c => c.creneau))
    const commonCreneau: Creneau = creneaux.size === 1 ? cells[0].creneau : 'journee'

    if (action === 'absence') {
      setPrefillDate(dateDebut)
      setPrefillDateFin(dateFin)
      setPrefillCreneau(commonCreneau)
      setEditingAbsence(null)
      setShowAbsenceModal(true)
    } else {
      // If selected cells already have replacements, open in edit mode
      const replacementCells = cells.filter(c => c.type === 'remplacement')
      if (replacementCells.length > 0) {
        const firstCell = replacementCells[0]
        const existingRepl = planningRemplacements.find(r => {
          const inRange = firstCell.date >= r.dateDebut && firstCell.date <= r.dateFin
          const creneauMatch = r.creneau === firstCell.creneau || r.creneau === 'journee' || firstCell.creneau === 'journee'
          return inRange && creneauMatch
        })
        if (existingRepl) {
          setEditingRemplacement(existingRepl)
          setShowReplacementModal(true)
          return
        }
      }

      setPrefillDate(dateDebut)
      setPrefillDateFin(dateFin)
      setPrefillCreneau(commonCreneau)
      setEditingRemplacement(null)
      setReplacementSkipMotif(cells.every(c => c.type === 'absence'))
      setShowReplacementModal(true)
    }
  }, [handleBatchDeleteAbsences, handleBatchDeleteRemplacements, planningRemplacements])

  // ─── Render helpers ──────────────────────────────────────────

  const getUrgencyBadge = (urgency: UrgencyLevel, joursRestants: number | null) => {
    if (urgency === 'replaced') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aucune</span>
    }
    if (urgency === 'urgent') {
      return (
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Urgent</span>
          {joursRestants !== null && <div className="text-[10px] text-red-600 mt-0.5">{Math.abs(joursRestants)}j de retard</div>}
        </div>
      )
    }
    if (urgency === 'warning') {
      return (
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Bientôt</span>
          {joursRestants !== null && <div className="text-[10px] text-amber-600 mt-0.5">{joursRestants}j restant</div>}
        </div>
      )
    }
    if (urgency === 'normal') {
      return (
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Normal</span>
          {joursRestants !== null && <div className="text-[10px] text-blue-600 mt-0.5">{joursRestants}j restant</div>}
        </div>
      )
    }
    return <span className="text-gray-400 text-sm">--</span>
  }

  // ─── Loading / Error states ──────────────────────────────────

  if (loading) {
    return (
      <div className="ds-empty-state">
        <div className="ds-empty-state-content">
          <div className="spinner-md mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  if (error || !absence) {
    return (
      <div className="ds-empty-state">
        <div className="ds-empty-state-content">
          <div className="ds-empty-state-icon-wrapper">
            <CalendarDaysIcon className="ds-empty-state-icon" />
          </div>
          <h3 className="ds-empty-state-title">{error || 'Absence non trouvée'}</h3>
          <Link href="/absences" className="btn btn-primary mt-4">
            Retour aux absences
          </Link>
        </div>
      </div>
    )
  }

  const personLink = absence.type === 'collaborateur'
    ? `/collaborateurs/${absence.collaborateurId}`
    : `/remplacants/${absence.remplacantId}`

  return (
    <div>
      {/* Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <CalendarDaysIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title flex items-center gap-3">
                Absence de {absence.personLastName?.toUpperCase()} {absence.personFirstName}
                {absence.type === 'collaborateur' && absence.replacementStatus === 'full' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Remplacée</span>
                )}
                {absence.type === 'collaborateur' && absence.replacementStatus === 'partial' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Partiellement remplacée</span>
                )}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  absence.type === 'collaborateur' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {TYPE_LABELS[absence.type]}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(absence.dateDebut)}
                  {absence.dateDebut !== absence.dateFin && ` → ${formatDate(absence.dateFin)}`}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {CRENEAU_LABELS[absence.creneau]}
                </span>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-700">
                  {MOTIF_LABELS[absence.motif]}
                  {absence.motifDetails && <span className="text-gray-400 ml-1">— {absence.motifDetails}</span>}
                </span>
                {absence.type === 'collaborateur' && (
                  <>
                    <span className="text-sm text-gray-500">•</span>
                    {getUrgencyBadge(absence.urgency, absence.joursRestants)}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/absences" className="btn btn-secondary inline-flex items-center gap-1.5">
              <ArrowLeftIcon className="w-4 h-4" />
              Retour
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10 mt-6">
        {/* Left column — Planning + Remplaçants + Actions */}
        <div className="space-y-6">
          {/* Section Planning (collaborateur only) */}
          {absence.type === 'collaborateur' && absence.collaborateurId && (
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase mb-4">Planning</h2>
                <CollaborateurMonthCalendar
                  presences={planningPresences}
                  remplacements={planningRemplacements}
                  absences={planningAbsences}
                  vacances={planningVacances}
                  initialDate={new Date(absence.dateDebut + 'T00:00:00')}
                  highlightCells={absenceHighlightCells}
                  onRemplacementClick={(r) => {
                    setEditingRemplacement(r as PlanningRemplacement)
                    setShowReplacementModal(true)
                  }}
                  onSelectionAction={handleSelectionAction}
                />
              </div>
            </div>
          )}

          {/* Available remplaçants (collaborateur only, while unreplaced slots remain) */}
          {absence.type === 'collaborateur' && unreplacedEntries.length > 0 && (
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase mb-4">Remplaçants disponibles</h2>

                {/* Créneaux détectés */}
                {computedEntries.length > 0 && (
                  <div className="mb-4">
                    <label className="form-label">Créneaux détectés</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex flex-wrap gap-2">
                        {jourOrder
                          .filter(j => entriesByJour.has(j))
                          .map(jour => {
                            const slots = entriesByJour.get(jour)!
                            return (
                              <div key={jour} className="bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs">
                                <div className="font-medium text-gray-800">{JOUR_LABELS[jour]}</div>
                                {slots.map((s, i) => {
                                  const avail = slotAvailability?.get(`${jour}:${s.creneau}:${s.ecoleName}`)
                                  const colorClass = avail
                                    ? avail.available === avail.total
                                      ? 'text-green-600'
                                      : avail.available > 0
                                        ? 'text-orange-600'
                                        : 'text-red-500'
                                    : 'text-gray-500'
                                  return (
                                    <div key={i} className={colorClass}>
                                      {PLANNING_CRENEAU_LABELS[s.creneau]} — {s.ecoleName}
                                      {avail && <span className="ml-1 opacity-75">({avail.available}/{avail.total})</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                )}
                {computedEntries.length === 0 && planningPresences.length > 0 && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    Aucun créneau de présence trouvé sur cette période.
                  </div>
                )}

                {/* Search */}
                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom..."
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    className="form-input pl-9"
                  />
                </div>

                {loadingAvailable ? (
                  <div className="flex items-center justify-center p-6">
                    <span className="inline-block w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
                    <span className="text-sm text-gray-500">Recherche...</span>
                  </div>
                ) : filteredSidebarRemplacants.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucun remplaçant disponible sur cette période
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      {filteredSidebarRemplacants.map((r) => (
                        <div
                          key={r.id}
                          className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors ${
                            selectedSidebarRemplacantId === r.id
                              ? 'bg-purple-50 ring-1 ring-inset ring-purple-300'
                              : 'hover:bg-purple-50'
                          }`}
                          onClick={() => setSelectedSidebarRemplacantId(prev => prev === r.id ? null : r.id)}
                        >
                          {(() => {
                            const avail = remplacantAvailabilityMap.get(r.id)
                            if (!avail || avail.total === 0) return null
                            const isFull = avail.available === avail.total
                            const isPartial = avail.available > 0
                            return (
                              <span className={`flex-shrink-0 inline-flex items-center justify-center min-w-[2.5rem] px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                isFull
                                  ? 'bg-green-100 text-green-700'
                                  : isPartial
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-red-100 text-red-600'
                              }`}>
                                {avail.available}/{avail.total}
                              </span>
                            )
                          })()}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/remplacants/${r.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium text-gray-900 hover:text-purple-600"
                            >
                              {r.lastName.toUpperCase()} {r.firstName}
                            </Link>
                            {(r.phone || r.email) && (
                              <div className="text-xs text-gray-400 mt-0.5 truncate">
                                {[r.phone, r.email].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openAssignModal(r) }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors flex-shrink-0"
                          >
                            <UserPlusIcon className="w-3.5 h-3.5" />
                            Affecter
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                      {availableRemplacants.length} disponible{availableRemplacants.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="ds-table-container">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-purple-700 uppercase mb-4">Actions</h2>
              <div className="space-y-2">
                {absence.type === 'collaborateur' && unreplacedEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSearchModal(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <MagnifyingGlassCircleIcon className="w-5 h-5" />
                    Rechercher via WhatsApp
                  </button>
                )}
                <Link
                  href={personLink}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  Voir la fiche {absence.type === 'collaborateur' ? 'collaborateur' : 'remplaçant'}
                </Link>
              </div>
            </div>
          </div>

          {/* Section Délai de remplacement (collaborateur only) */}
          {absence.type === 'collaborateur' && absence.collaborateurEcoles.length > 0 && (
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase mb-4">Délai de remplacement</h2>
                <div className="space-y-2">
                  {absence.collaborateurEcoles.map((ecole) => (
                    <div key={ecole.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <Link href={`/ecoles/${ecole.id}`} className="text-sm font-medium text-purple-600 hover:underline">
                        {ecole.name}
                      </Link>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                          {ecole.remplacementApresJours != null
                            ? `${ecole.remplacementApresJours} jour${Number(ecole.remplacementApresJours) > 1 ? 's' : ''}`
                            : <span className="text-gray-400">Non défini</span>
                          }
                        </span>
                        {getUrgencyBadge(ecole.urgency, ecole.joursRestants)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section Remplacement */}
          {absenceRemplacements.length > 0 && (
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase mb-4">Remplacement</h2>
                {unreplacedEntries.length === 0 ? (
                  <span className="status-badge-success mb-3 inline-block">Entièrement remplacée</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 mb-3">Partiellement remplacée</span>
                )}
                <div className="space-y-2">
                  {(() => {
                    const grouped = new Map<number, { nom: string | null; prenom: string | null; creneaux: PlanningRemplacement[] }>()
                    for (const r of absenceRemplacements) {
                      const existing = grouped.get(r.remplacantId)
                      if (existing) {
                        existing.creneaux.push(r)
                      } else {
                        grouped.set(r.remplacantId, { nom: r.remplacantNom, prenom: r.remplacantPrenom, creneaux: [r] })
                      }
                    }
                    return Array.from(grouped.entries()).map(([remplacantId, { nom, prenom, creneaux }]) => (
                      <div key={remplacantId} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/remplacants/${remplacantId}`}
                            className="text-sm font-medium text-purple-600 hover:underline"
                          >
                            {prenom} {nom?.toUpperCase()}
                          </Link>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {(() => {
                              let count = 0
                              for (const c of creneaux) {
                                const days = Math.max(1, Math.round((new Date(c.dateFin + 'T00:00:00').getTime() - new Date(c.dateDebut + 'T00:00:00').getTime()) / 86400000) + 1)
                                count += c.creneau === 'journee' ? days * 2 : days
                              }
                              return `${count} créneau${count > 1 ? 'x' : ''}`
                            })()}
                          </div>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Section Réponses WhatsApp */}
          {absence.whatsappSent > 0 && (
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase mb-4">Réponses WhatsApp</h2>

                {/* Summary */}
                <div className="flex items-center gap-2 mb-4 flex-wrap text-sm">
                  {absence.whatsappDisponible.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {absence.whatsappDisponible.length} disponible{absence.whatsappDisponible.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {absence.whatsappEnAttente > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                      {absence.whatsappEnAttente} en attente
                    </span>
                  )}
                  {absence.whatsappPasDisponible > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      {absence.whatsappPasDisponible} indisponible{absence.whatsappPasDisponible > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Responses list */}
                {loadingResponses ? (
                  <div className="flex items-center justify-center p-6">
                    <span className="inline-block w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
                    <span className="text-sm text-gray-500">Chargement...</span>
                  </div>
                ) : responses.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                      {responses.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0"
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            r.response === 'disponible' ? 'bg-green-500' :
                            r.response === 'pas_disponible' ? 'bg-red-500' :
                            'bg-yellow-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">
                              <Link
                                href={`/remplacants/${r.remplacantId}`}
                                className="font-medium text-gray-900 hover:text-purple-600"
                              >
                                {r.remplacantLastName?.toUpperCase()} {r.remplacantFirstName}
                              </Link>
                            </div>
                            <div className="text-xs text-gray-400">
                              {r.phone} {r.createdAt && <>• Envoyé {formatDateTime(r.createdAt)}</>}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {r.response === 'disponible' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Disponible</span>
                            ) : r.response === 'pas_disponible' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Indisponible</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">En attente</span>
                            )}
                          </div>
                          {r.respondedAt && (
                            <div className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                              {formatDateTime(r.respondedAt)}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteResponse(r.id)}
                            className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Bouton Supprimer en bas à gauche */}
      <div className="mt-8">
        <button
          type="button"
          onClick={handleDeleteAbsence}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
          Supprimer l&apos;absence
        </button>
      </div>

      {/* ─── Modal Affectation ──────────────────────────────────── */}
      <AssignRemplacantModal
        isOpen={showAssignModal && !!assigningRemplacant && !!absence}
        onClose={() => setShowAssignModal(false)}
        personFirstName={absence?.personFirstName ?? null}
        personLastName={absence?.personLastName ?? null}
        dateDebut={absence?.dateDebut ?? ''}
        dateFin={absence?.dateFin ?? ''}
        creneau={absence?.creneau ?? ''}
        motif={absence?.motif ?? ''}
        ecoles={absence?.collaborateurEcoles ?? []}
        preSelectedRemplacant={assigningRemplacant ? { id: assigningRemplacant.id, lastName: assigningRemplacant.lastName, firstName: assigningRemplacant.firstName } : null}
        onAssign={handleAssignRemplacement}
        assigningLoading={assigningLoading}
      />

      {/* ─── Modal Recherche WhatsApp ───────────────────────────── */}
      <WhatsAppSearchModal
        isOpen={showSearchModal && !!absence}
        onClose={() => setShowSearchModal(false)}
        absenceId={absence?.id ?? 0}
        personFirstName={absence?.personFirstName ?? null}
        personLastName={absence?.personLastName ?? null}
        dateDebut={absence?.dateDebut ?? ''}
        dateFin={absence?.dateFin ?? ''}
        creneau={absence?.creneau ?? ''}
        motif={absence?.motif ?? ''}
        ecoles={absence?.collaborateurEcoles ?? []}
        onSuccess={fetchAbsence}
      />

      {/* ─── Interactive calendar modals ──────────────────────────── */}
      {absence.type === 'collaborateur' && absence.collaborateurId && (
        <>
          <AbsenceModal
            isOpen={showAbsenceModal}
            onClose={() => { setShowAbsenceModal(false); setEditingAbsence(null); setPrefillDate(null); setPrefillDateFin(null); setPrefillCreneau(null) }}
            onSave={handleSaveAbsence}
            editingAbsence={editingAbsence || undefined}
            prefillDate={prefillDate || undefined}
            prefillDateFin={prefillDateFin || undefined}
            prefillCreneau={prefillCreneau || undefined}
          />
          <ReplacementModal
            collaborateurId={absence.collaborateurId}
            presences={planningPresences}
            isOpen={showReplacementModal}
            onClose={() => { setShowReplacementModal(false); setEditingRemplacement(null); setPrefillDate(null); setPrefillDateFin(null); setPrefillCreneau(null); setReplacementSkipMotif(false) }}
            onSave={handleSaveReplacement}
            onUpdate={handleUpdateReplacement}
            editingRemplacement={editingRemplacement || undefined}
            prefillDate={prefillDate || undefined}
            prefillDateFin={prefillDateFin || undefined}
            prefillCreneau={prefillCreneau || undefined}
            skipMotif={replacementSkipMotif}
          />
        </>
      )}
    </div>
  )
}
