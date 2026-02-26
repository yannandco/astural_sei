'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDaysIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import {
  MonthCalendar, CollaborateurMonthCalendar, AbsenceModal, DisponibiliteModal,
  CRENEAU_LABELS, formatDate,
} from '@/components/planning'
import type {
  Creneau, JourSemaine, DisponibiliteSpecifique, Affectation, AbsenceData, VacancesScolaires,
} from '@/components/planning'
import type { RemplacantSelectedCell } from '@/components/planning/MonthCalendar'
import type { SelectedCell } from '@/components/planning/CollaborateurMonthCalendar'

interface JourPresence {
  jour: JourSemaine
  creneau: Creneau
}

interface Presence {
  ecoleId: number
  ecoleName: string
  joursPresence: JourPresence[]
}

interface Remplacement {
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

interface PortailMeData {
  role: 'collaborateur' | 'remplacant'
  collaborateur?: { id: number; firstName: string; lastName: string; email: string | null }
  remplacant?: { id: number; firstName: string; lastName: string; email: string | null }
}

// ─── Composant principal ──────────────────────────────────

export default function PortailPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [meData, setMeData] = useState<PortailMeData | null>(null)

  // ─── Remplaçant planning state ───────────────────────────
  const [specifiques, setSpecifiques] = useState<DisponibiliteSpecifique[]>([])
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [absencesRempl, setAbsencesRempl] = useState<AbsenceData[]>([])
  const [vacances, setVacances] = useState<VacancesScolaires[]>([])

  // Remplaçant modals
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [showDisponibiliteModal, setShowDisponibiliteModal] = useState(false)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillDateFin, setPrefillDateFin] = useState<string | null>(null)
  const [prefillCreneau, setPrefillCreneau] = useState<Creneau | null>(null)

  // ─── Collaborateur planning state ──────────────────────────
  const [collabPresences, setCollabPresences] = useState<Presence[]>([])
  const [collabRemplacements, setCollabRemplacements] = useState<Remplacement[]>([])
  const [collabAbsences, setCollabAbsences] = useState<AbsenceData[]>([])
  const [collabVacances, setCollabVacances] = useState<VacancesScolaires[]>([])

  // Collaborateur absence modal (from calendar selection)
  const [showCollabAbsenceModal, setShowCollabAbsenceModal] = useState(false)
  const [collabPrefillDate, setCollabPrefillDate] = useState<string | null>(null)
  const [collabPrefillDateFin, setCollabPrefillDateFin] = useState<string | null>(null)
  const [collabPrefillCreneau, setCollabPrefillCreneau] = useState<Creneau | null>(null)

  // ─── Data fetching ───────────────────────────────────────

  const fetchPlanningData = useCallback(async (remplacantId: number) => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const startDate = formatDate(start)
    const end = new Date(today.getFullYear(), today.getMonth() + 4, 0)
    const endDateStr = formatDate(end)

    const [specRes, affRes, vacRes, absRes] = await Promise.all([
      fetch(`/api/remplacants/${remplacantId}/disponibilites/specifiques?startDate=${startDate}&endDate=${endDateStr}`),
      fetch(`/api/remplacants/${remplacantId}/affectations?startDate=${startDate}&endDate=${endDateStr}`),
      fetch(`/api/vacances-scolaires?startDate=${startDate}&endDate=${endDateStr}`),
      fetch(`/api/remplacants/${remplacantId}/absences?startDate=${startDate}&endDate=${endDateStr}`),
    ])

    if (specRes.ok) {
      const { data } = await specRes.json()
      setSpecifiques(data)
    }
    if (affRes.ok) {
      const { data } = await affRes.json()
      setAffectations(data)
    }
    if (vacRes.ok) {
      const { data } = await vacRes.json()
      setVacances(data)
    }
    if (absRes.ok) {
      const { data } = await absRes.json()
      setAbsencesRempl(data || [])
    }
  }, [])

  const fetchCollabPlanningData = useCallback(async (collaborateurId: number) => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const startDate = formatDate(start)
    const end = new Date(today.getFullYear(), today.getMonth() + 4, 0)
    const endDateStr = formatDate(end)

    const [planRes, absRes, vacRes] = await Promise.all([
      fetch(`/api/collaborateurs/${collaborateurId}/planning?startDate=${startDate}&endDate=${endDateStr}`),
      fetch(`/api/collaborateurs/${collaborateurId}/absences?startDate=${startDate}&endDate=${endDateStr}`),
      fetch(`/api/vacances-scolaires?startDate=${startDate}&endDate=${endDateStr}`),
    ])

    if (planRes.ok) {
      const { data } = await planRes.json()
      setCollabPresences(data.presences || [])
      setCollabRemplacements(data.remplacements || [])
    }
    if (absRes.ok) {
      const { data } = await absRes.json()
      setCollabAbsences(data || [])
    }
    if (vacRes.ok) {
      const { data } = await vacRes.json()
      setCollabVacances(data)
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/portail/me')
      if (!res.ok) {
        router.push('/login')
        return
      }
      const json = await res.json()
      const data = json.data
      setMeData({ role: data.role, collaborateur: data.collaborateur, remplacant: data.remplacant })

      if (data.role === 'remplacant' && data.remplacant) {
        await fetchPlanningData(data.remplacant.id)
      }

      if (data.role === 'collaborateur' && data.collaborateur) {
        await fetchCollabPlanningData(data.collaborateur.id)
      }
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router, fetchPlanningData, fetchCollabPlanningData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Remplaçant handlers ─────────────────────────────────

  const remplacantId = meData?.remplacant?.id

  const handleRefreshPlanning = useCallback(() => {
    if (remplacantId) fetchPlanningData(remplacantId)
  }, [remplacantId, fetchPlanningData])

  const handleBatchDisponibilite = useCallback(async (
    cells: RemplacantSelectedCell[],
    isAvailable: boolean
  ) => {
    if (!remplacantId) return
    await Promise.all(
      cells.map(cell =>
        fetch(`/api/remplacants/${remplacantId}/disponibilites/specifiques`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: cell.date, creneau: cell.creneau, isAvailable }),
        })
      )
    )
    await fetchPlanningData(remplacantId)
  }, [remplacantId, fetchPlanningData])

  const handleBatchEffacer = useCallback(async (
    cells: RemplacantSelectedCell[]
  ) => {
    if (!remplacantId) return
    await Promise.all(
      cells
        .filter(cell => cell.status === 'disponible_specifique' || cell.status === 'indisponible_exception')
        .map(cell =>
          fetch(`/api/remplacants/${remplacantId}/disponibilites/specifiques?date=${cell.date}&creneau=${cell.creneau}`, {
            method: 'DELETE',
          })
        )
    )
    await fetchPlanningData(remplacantId)
  }, [remplacantId, fetchPlanningData])

  const handleSelectionAction = useCallback((
    action: 'absence' | 'remplacement' | 'disponibilite' | 'exception' | 'effacer',
    cells: RemplacantSelectedCell[]
  ) => {
    if (action === 'disponibilite') {
      handleBatchDisponibilite(cells, true)
      return
    }
    if (action === 'exception' || action === 'effacer') {
      handleBatchEffacer(cells)
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
      setShowAbsenceModal(true)
    }
  }, [handleBatchDisponibilite, handleBatchEffacer])

  const handleSaveAbsence = async (data: {
    dateDebut: string
    dateFin: string
    creneau: Creneau
    motif: string
    motifDetails?: string
  }) => {
    if (!remplacantId) return
    const res = await fetch(`/api/remplacants/${remplacantId}/absences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const { error } = await res.json()
      alert(error || 'Erreur lors de la création')
      return
    }
    await fetchPlanningData(remplacantId)
  }

  // ─── Collaborateur handlers ──────────────────────────────

  const collaborateurId = meData?.collaborateur?.id

  const handleCollabSelectionAction = useCallback((
    action: 'absence' | 'remplacement' | 'supprimer_absence' | 'supprimer_remplacement',
    cells: SelectedCell[]
  ) => {
    if (action === 'absence') {
      const dates = cells.map(c => c.date).sort()
      const creneaux = new Set(cells.map(c => c.creneau))
      const commonCreneau: Creneau = creneaux.size === 1 ? cells[0].creneau : 'journee'
      setCollabPrefillDate(dates[0])
      setCollabPrefillDateFin(dates[dates.length - 1])
      setCollabPrefillCreneau(commonCreneau)
      setShowCollabAbsenceModal(true)
    }
  }, [])

  const handleSaveCollabAbsence = async (data: {
    dateDebut: string; dateFin: string; creneau: Creneau; motif: string; motifDetails?: string
  }) => {
    if (!collaborateurId) return
    const res = await fetch('/api/portail/absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error || 'Erreur lors de la création')
      return
    }
    setShowCollabAbsenceModal(false)
    await fetchCollabPlanningData(collaborateurId)
  }

  // ─── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700"></div>
      </div>
    )
  }

  if (!meData) return null

  // ─── Collaborateur view — Planning ────────────────────────
  if (meData.role === 'collaborateur') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour, {meData.collaborateur?.firstName}
          </h1>
          <p className="text-gray-500 mt-1">Votre planning</p>
        </div>

        <div className="ds-table-container">
          <div className="p-5">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4" />
              Mon planning
            </h2>
            <CollaborateurMonthCalendar
              presences={collabPresences}
              remplacements={collabRemplacements}
              absences={collabAbsences}
              vacances={collabVacances}
              onSelectionAction={handleCollabSelectionAction}
              portailMode
            />
          </div>
        </div>

        {/* Modal Absence collaborateur */}
        <AbsenceModal
          isOpen={showCollabAbsenceModal}
          onClose={() => { setShowCollabAbsenceModal(false); setCollabPrefillDate(null); setCollabPrefillDateFin(null); setCollabPrefillCreneau(null) }}
          onSave={handleSaveCollabAbsence}
          prefillDate={collabPrefillDate || undefined}
          prefillDateFin={collabPrefillDateFin || undefined}
          prefillCreneau={collabPrefillCreneau || undefined}
        />
      </div>
    )
  }

  // ─── Remplaçant view — Planning ───────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour, {meData.remplacant?.firstName}
        </h1>
        <p className="text-gray-500 mt-1">Votre planning</p>
      </div>

      <div className="ds-table-container">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4" />
              Mon planning
            </h2>
            <button
              type="button"
              onClick={() => setShowDisponibiliteModal(true)}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Gérer les disponibilités
            </button>
          </div>
          {remplacantId && (
            <MonthCalendar
              remplacantId={remplacantId}
              specifiques={specifiques}
              affectations={affectations}
              absences={absencesRempl}
              vacances={vacances}
              onRefresh={handleRefreshPlanning}
              portailMode
              onSelectionAction={handleSelectionAction}
            />
          )}
        </div>
      </div>

      {/* Modal Disponibilité */}
      {remplacantId && (
        <DisponibiliteModal
          remplacantId={remplacantId}
          isOpen={showDisponibiliteModal}
          onClose={() => setShowDisponibiliteModal(false)}
          onSave={handleRefreshPlanning}
        />
      )}

      {/* Modal Absence */}
      <AbsenceModal
        isOpen={showAbsenceModal}
        onClose={() => { setShowAbsenceModal(false); setPrefillDate(null); setPrefillDateFin(null); setPrefillCreneau(null) }}
        onSave={handleSaveAbsence}
        prefillDate={prefillDate || undefined}
        prefillDateFin={prefillDateFin || undefined}
        prefillCreneau={prefillCreneau || undefined}
      />
    </div>
  )
}
