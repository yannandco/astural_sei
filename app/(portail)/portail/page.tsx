'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDaysIcon, PlusIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import {
  MonthCalendar, AbsenceModal, DisponibiliteModal,
  CRENEAU_LABELS, MOTIF_LABELS, formatDate,
} from '@/components/planning'
import type {
  Creneau, DisponibiliteSpecifique, Affectation, AbsenceData, VacancesScolaires,
} from '@/components/planning'
import type { RemplacantSelectedCell } from '@/components/planning/MonthCalendar'

// ─── Types ────────────────────────────────────────────────

interface PortailAbsence {
  id: number
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string
  motifDetails: string | null
  isRemplacee?: boolean
  remplacements?: {
    id: number
    remplacantNom: string | null
    remplacantPrenom: string | null
    ecoleNom: string | null
    dateDebut: string
    dateFin: string
    creneau: Creneau
  }[]
}

interface PortailRemplacement {
  id: number
  collaborateurId?: number
  collaborateurNom?: string | null
  collaborateurPrenom?: string | null
  ecoleId: number
  ecoleNom: string | null
  directeurNom?: string | null
  directeurPrenom?: string | null
  directeurEmail?: string | null
  directeurPhone?: string | null
  titulairesNoms?: string | null
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

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateRange(debut: string, fin: string): string {
  if (debut === fin) return formatDisplayDate(debut)
  return `${formatDisplayDate(debut)} — ${formatDisplayDate(fin)}`
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

  // Modals
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [showDisponibiliteModal, setShowDisponibiliteModal] = useState(false)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillDateFin, setPrefillDateFin] = useState<string | null>(null)
  const [prefillCreneau, setPrefillCreneau] = useState<Creneau | null>(null)

  // Affectations lists
  const [futureAffectations, setFutureAffectations] = useState<PortailRemplacement[]>([])
  const [pastAffectations, setPastAffectations] = useState<PortailRemplacement[]>([])
  const [showPast, setShowPast] = useState(false)

  // ─── Collaborateur state ─────────────────────────────────
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)
  const [absenceForm, setAbsenceForm] = useState({
    dateDebut: '', dateFin: '', creneau: 'journee' as Creneau, motif: 'maladie', motifDetails: '',
  })
  const [absenceLoading, setAbsenceLoading] = useState(false)
  const [absenceError, setAbsenceError] = useState('')
  const [allAbsences, setAllAbsences] = useState<PortailAbsence[]>([])

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

        // Fetch enriched affectations
        const [futureRes, pastRes] = await Promise.all([
          fetch('/api/portail/affectations?period=future'),
          fetch('/api/portail/affectations?period=past'),
        ])
        const futureData = await futureRes.json()
        const pastData = await pastRes.json()
        setFutureAffectations(futureData.data || [])
        setPastAffectations(pastData.data || [])
      }

      if (data.role === 'collaborateur') {
        const absRes = await fetch('/api/portail/absences')
        const absData = await absRes.json()
        setAllAbsences(absData.data || [])
      }
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router, fetchPlanningData])

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

  const handleCreateCollabAbsence = async () => {
    setAbsenceError('')
    setAbsenceLoading(true)
    try {
      const res = await fetch('/api/portail/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(absenceForm),
      })
      const json = await res.json()
      if (!res.ok) {
        setAbsenceError(json.error || 'Erreur')
        return
      }
      setShowAbsenceForm(false)
      setAbsenceForm({ dateDebut: '', dateFin: '', creneau: 'journee', motif: 'maladie', motifDetails: '' })
      fetchData()
    } catch {
      setAbsenceError('Erreur serveur')
    } finally {
      setAbsenceLoading(false)
    }
  }

  const handleDeleteCollabAbsence = async (absenceId: number) => {
    if (!confirm('Supprimer cette absence ?')) return
    await fetch(`/api/portail/absences?id=${absenceId}`, { method: 'DELETE' })
    fetchData()
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

  // ─── Collaborateur view ─────────────────────────────────
  if (meData.role === 'collaborateur') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour, {meData.collaborateur?.firstName}
          </h1>
          <p className="text-gray-500 mt-1">Votre espace personnel</p>
        </div>

        {/* Déclarer une absence */}
        <div className="ds-table-container">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider">
                Déclarer une absence
              </h2>
              {!showAbsenceForm && (
                <button
                  onClick={() => setShowAbsenceForm(true)}
                  className="btn btn-primary text-sm flex items-center gap-1"
                >
                  <PlusIcon className="w-4 h-4" /> Nouvelle absence
                </button>
              )}
            </div>

            {showAbsenceForm && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Date de début</label>
                    <input
                      type="date"
                      value={absenceForm.dateDebut}
                      onChange={(e) => setAbsenceForm(f => ({ ...f, dateDebut: e.target.value, dateFin: f.dateFin || e.target.value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date de fin</label>
                    <input
                      type="date"
                      value={absenceForm.dateFin}
                      onChange={(e) => setAbsenceForm(f => ({ ...f, dateFin: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Créneau</label>
                    <select
                      value={absenceForm.creneau}
                      onChange={(e) => setAbsenceForm(f => ({ ...f, creneau: e.target.value as Creneau }))}
                      className="form-input"
                    >
                      <option value="journee">Journée entière</option>
                      <option value="matin">Matin</option>
                      <option value="apres_midi">Après-midi</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Motif</label>
                    <select
                      value={absenceForm.motif}
                      onChange={(e) => setAbsenceForm(f => ({ ...f, motif: e.target.value }))}
                      className="form-input"
                    >
                      <option value="maladie">Maladie</option>
                      <option value="conge">Congé</option>
                      <option value="formation">Formation</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Détails (optionnel)</label>
                  <textarea
                    value={absenceForm.motifDetails}
                    onChange={(e) => setAbsenceForm(f => ({ ...f, motifDetails: e.target.value }))}
                    className="form-input"
                    rows={2}
                  />
                </div>
                {absenceError && <p className="text-sm text-red-600">{absenceError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateCollabAbsence}
                    disabled={absenceLoading || !absenceForm.dateDebut || !absenceForm.dateFin}
                    className="btn btn-primary text-sm"
                  >
                    {absenceLoading ? 'Envoi...' : 'Déclarer'}
                  </button>
                  <button
                    onClick={() => { setShowAbsenceForm(false); setAbsenceError('') }}
                    className="btn btn-secondary text-sm"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mes absences */}
        <div className="ds-table-container">
          <div className="p-5">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              Mes absences
            </h2>
            {allAbsences.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune absence déclarée.</p>
            ) : (
              <div className="space-y-3">
                {allAbsences.map((absence) => {
                  const today = new Date().toISOString().split('T')[0]
                  const isFuture = absence.dateDebut >= today
                  return (
                    <div key={absence.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {formatDateRange(absence.dateDebut, absence.dateFin)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {CRENEAU_LABELS[absence.creneau as Creneau] || absence.creneau}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            absence.isRemplacee
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {absence.isRemplacee ? 'Remplacée' : 'Non remplacée'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {MOTIF_LABELS[absence.motif] || absence.motif}
                          {absence.motifDetails && ` — ${absence.motifDetails}`}
                        </p>
                        {absence.remplacements && absence.remplacements.length > 0 && (
                          <p className="text-xs text-purple-600 mt-1">
                            Remplacé(e) par : {absence.remplacements.map(r =>
                              `${r.remplacantPrenom} ${r.remplacantNom}`
                            ).join(', ')}
                          </p>
                        )}
                      </div>
                      {isFuture && (
                        <button
                          onClick={() => handleDeleteCollabAbsence(absence.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Supprimer"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Remplaçant view ────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour, {meData.remplacant?.firstName}
        </h1>
        <p className="text-gray-500 mt-1">Votre espace personnel</p>
      </div>

      {/* Planning calendrier */}
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

      {/* Remplacements à venir */}
      <div className="ds-table-container">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Remplacements à venir
          </h2>
          {futureAffectations.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun remplacement à venir.</p>
          ) : (
            <div className="space-y-3">
              {futureAffectations.map((aff) => (
                <div key={aff.id} className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatDateRange(aff.dateDebut, aff.dateFin)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {CRENEAU_LABELS[aff.creneau] || aff.creneau}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    <p>Collaborateur : <span className="font-medium">{aff.collaborateurPrenom} {aff.collaborateurNom}</span></p>
                    <p>École : <span className="font-medium">{aff.ecoleNom}</span></p>
                  </div>
                  {(aff.directeurNom || aff.titulairesNoms) && (
                    <div className="text-xs text-gray-500 space-y-1 pt-1 border-t border-gray-200">
                      {aff.directeurNom && (
                        <p>
                          Directeur : {aff.directeurPrenom} {aff.directeurNom}
                          {aff.directeurEmail && ` — ${aff.directeurEmail}`}
                          {aff.directeurPhone && ` — ${aff.directeurPhone}`}
                        </p>
                      )}
                      {aff.titulairesNoms && (
                        <p>Titulaires : {aff.titulairesNoms}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Remplacements passés */}
      <div className="ds-table-container">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider">
              Remplacements passés
            </h2>
            <button
              onClick={() => setShowPast(!showPast)}
              className="text-sm text-purple-600 hover:text-purple-800"
            >
              {showPast ? 'Masquer' : `Voir (${pastAffectations.length})`}
            </button>
          </div>
          {showPast && (
            pastAffectations.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun remplacement passé.</p>
            ) : (
              <div className="space-y-2">
                {pastAffectations.map((aff) => (
                  <div key={aff.id} className="p-3 bg-gray-50 rounded-lg opacity-75">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">
                        {formatDateRange(aff.dateDebut, aff.dateFin)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {CRENEAU_LABELS[aff.creneau] || aff.creneau}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {aff.collaborateurPrenom} {aff.collaborateurNom} — {aff.ecoleNom}
                    </p>
                  </div>
                ))}
              </div>
            )
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
