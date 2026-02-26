'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PlusIcon, TrashIcon, CalendarDaysIcon, ChevronDownIcon,
  MagnifyingGlassIcon, ClockIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { AbsenceModal, CRENEAU_LABELS, MOTIF_LABELS } from '@/components/planning'
import type { Creneau } from '@/components/planning'

// ─── Types ────────────────────────────────────────────────

interface PortailAbsence {
  id: number
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string
  motifDetails: string | null
  isRemplacee?: boolean
  isActive?: boolean
  remplacements?: {
    id: number
    remplacantNom: string | null
    remplacantPrenom: string | null
    ecoleNom: string | null
    dateDebut: string
    dateFin: string
    creneau: Creneau
  }[]
  affectationsImpactees?: {
    id: number
    collaborateurNom: string | null
    collaborateurPrenom: string | null
    ecoleNom: string | null
    dateDebut: string
    dateFin: string
    creneau: string
  }[]
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

export default function AbsencesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'collaborateur' | 'remplacant'>('collaborateur')
  const [remplacantId, setRemplacantId] = useState<number | null>(null)
  const [absences, setAbsences] = useState<PortailAbsence[]>([])

  // Collaborateur form state
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)
  const [absenceForm, setAbsenceForm] = useState({
    dateDebut: '', dateFin: '', creneau: 'journee' as Creneau, motif: 'maladie', motifDetails: '',
  })
  const [absenceLoading, setAbsenceLoading] = useState(false)
  const [absenceError, setAbsenceError] = useState('')

  // Remplaçant modal
  const [showModal, setShowModal] = useState(false)

  // Past section state
  const [showPast, setShowPast] = useState(false)
  const [expandedPast, setExpandedPast] = useState<Record<number, boolean>>({})
  const [searchPast, setSearchPast] = useState('')

  const fetchAbsences = useCallback(async (userRole: string, rId: number | null) => {
    if (userRole === 'remplacant' && rId) {
      const res = await fetch(`/api/remplacants/${rId}/absences`)
      if (res.ok) {
        const { data } = await res.json()
        setAbsences(data || [])
      }
    } else {
      const res = await fetch('/api/portail/absences')
      if (res.ok) {
        const { data } = await res.json()
        setAbsences(data || [])
      }
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const meRes = await fetch('/api/portail/me')
      if (!meRes.ok) { router.push('/login'); return }
      const meJson = await meRes.json()
      const data = meJson.data
      setRole(data.role)

      if (data.role === 'remplacant' && data.remplacant) {
        setRemplacantId(data.remplacant.id)
        await fetchAbsences('remplacant', data.remplacant.id)
      } else {
        await fetchAbsences('collaborateur', null)
      }
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router, fetchAbsences])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Derived data ────────────────────────────────────────

  const today = new Date().toISOString().split('T')[0]

  const futureAbsences = useMemo(
    () => absences.filter(a => a.dateFin >= today),
    [absences, today]
  )
  const pastAbsences = useMemo(
    () => absences.filter(a => a.dateFin < today),
    [absences, today]
  )

  const filteredPastAbsences = useMemo(() => {
    if (!searchPast.trim()) return pastAbsences
    const q = searchPast.toLowerCase().trim()
    return pastAbsences.filter(a =>
      (MOTIF_LABELS[a.motif] || a.motif).toLowerCase().includes(q)
      || (a.motifDetails && a.motifDetails.toLowerCase().includes(q))
      || formatDateRange(a.dateDebut, a.dateFin).includes(q)
      || (a.remplacements || []).some(r =>
        `${r.remplacantPrenom} ${r.remplacantNom}`.toLowerCase().includes(q)
        || (r.ecoleNom && r.ecoleNom.toLowerCase().includes(q))
      )
      || (a.affectationsImpactees || []).some(ai =>
        `${ai.collaborateurPrenom} ${ai.collaborateurNom}`.toLowerCase().includes(q)
        || (ai.ecoleNom && ai.ecoleNom.toLowerCase().includes(q))
      )
    )
  }, [pastAbsences, searchPast])

  const togglePast = (id: number) => {
    setExpandedPast(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ─── Handlers ────────────────────────────────────────────

  // Collaborateur: create absence via form
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

  // Collaborateur: delete absence
  const handleDeleteCollabAbsence = async (absenceId: number) => {
    if (!confirm('Supprimer cette absence ?')) return
    await fetch(`/api/portail/absences?id=${absenceId}`, { method: 'DELETE' })
    fetchData()
  }

  // Remplaçant: create absence via modal
  const handleSaveRemplacantAbsence = async (data: {
    dateDebut: string; dateFin: string; creneau: Creneau; motif: string; motifDetails?: string
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
    setShowModal(false)
    await fetchAbsences('remplacant', remplacantId)
  }

  // Remplaçant: delete absence
  const handleDeleteRemplacantAbsence = async (absenceId: number) => {
    if (!remplacantId) return
    if (!confirm('Supprimer cette absence ?')) return
    await fetch(`/api/remplacants/${remplacantId}/absences?absenceId=${absenceId}`, { method: 'DELETE' })
    await fetchAbsences('remplacant', remplacantId)
  }

  const handleDelete = role === 'collaborateur' ? handleDeleteCollabAbsence : handleDeleteRemplacantAbsence

  // ─── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700"></div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes absences</h1>
          <p className="text-gray-500 mt-1">Déclarez et consultez vos absences</p>
        </div>
        {role === 'collaborateur' ? (
          !showAbsenceForm && (
            <button
              onClick={() => setShowAbsenceForm(true)}
              className="btn btn-primary text-sm flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Nouvelle absence
            </button>
          )
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary text-sm flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" /> Déclarer une absence
          </button>
        )}
      </div>

      {/* Collaborateur: inline form */}
      {role === 'collaborateur' && showAbsenceForm && (
        <div className="ds-table-container">
          <div className="p-5">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Déclarer une absence
            </h2>
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
          </div>
        </div>
      )}

      {/* Absences en cours et à venir */}
      <div className="ds-table-container">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4" />
            Absences en cours et à venir
          </h2>
          {futureAbsences.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune absence en cours ou à venir.</p>
          ) : (
            <div className="space-y-3">
              {futureAbsences.map((absence) => (
                <div key={absence.id} className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CalendarDaysIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDateRange(absence.dateDebut, absence.dateFin)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {CRENEAU_LABELS[absence.creneau] || absence.creneau}
                      </span>
                      {role === 'collaborateur' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          absence.isRemplacee
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {absence.isRemplacee ? 'Remplacée' : 'Non remplacée'}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(absence.id)}
                      className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0"
                      title="Supprimer"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">
                    {MOTIF_LABELS[absence.motif] || absence.motif}
                    {absence.motifDetails && ` — ${absence.motifDetails}`}
                  </p>
                  {/* Collaborateur: remplaçant info */}
                  {absence.remplacements && absence.remplacements.length > 0 && (
                    <p className="text-xs text-purple-600">
                      Remplacé(e) par : {absence.remplacements.map(r =>
                        `${r.remplacantPrenom} ${r.remplacantNom}`
                      ).join(', ')}
                    </p>
                  )}
                  {/* Remplaçant: impacted assignments */}
                  {absence.affectationsImpactees && absence.affectationsImpactees.length > 0 && (
                    <p className="text-xs text-orange-600">
                      Remplacements impactés : {absence.affectationsImpactees.map(a =>
                        `${a.collaborateurPrenom} ${a.collaborateurNom} (${a.ecoleNom})`
                      ).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Absences passées */}
      <div className="ds-table-container">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
              <ClockIcon className="w-4 h-4" />
              Absences passées
              <span className="text-xs font-normal text-gray-400">({pastAbsences.length})</span>
            </h2>
            <button
              onClick={() => setShowPast(!showPast)}
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`} />
              {showPast ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showPast ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {/* Recherche */}
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchPast}
                onChange={(e) => setSearchPast(e.target.value)}
                placeholder="Rechercher par motif, date, remplaçant..."
                className="form-input pl-9 text-sm"
              />
            </div>

            {filteredPastAbsences.length === 0 ? (
              <p className="text-sm text-gray-500">
                {searchPast.trim() ? 'Aucun résultat.' : 'Aucune absence passée.'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredPastAbsences.map((absence) => {
                  const isExpanded = expandedPast[absence.id] || false
                  return (
                    <div key={absence.id} className="bg-gray-50 rounded-lg overflow-hidden">
                      {/* Header — always visible */}
                      <button
                        onClick={() => togglePast(absence.id)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ClockIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">
                                {formatDateRange(absence.dateDebut, absence.dateFin)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {CRENEAU_LABELS[absence.creneau] || absence.creneau}
                              </span>
                              {role === 'collaborateur' && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  absence.isRemplacee
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {absence.isRemplacee ? 'Remplacée' : 'Non remplacée'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              {MOTIF_LABELS[absence.motif] || absence.motif}
                            </p>
                          </div>
                        </div>
                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Expanded details */}
                      <div className={`transition-all duration-200 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-gray-200">
                          {absence.motifDetails && (
                            <p className="text-xs text-gray-500 pt-2">
                              Détails : {absence.motifDetails}
                            </p>
                          )}
                          {absence.remplacements && absence.remplacements.length > 0 && (
                            <div className="pt-1 space-y-1">
                              {absence.remplacements.map((r) => (
                                <div key={r.id} className="flex items-center gap-2 text-sm">
                                  <CalendarDaysIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                  <span className="text-gray-600">
                                    {r.remplacantPrenom} {r.remplacantNom}
                                  </span>
                                  {r.ecoleNom && (
                                    <span className="text-xs text-gray-400">— {r.ecoleNom}</span>
                                  )}
                                  <span className="text-xs text-gray-400">
                                    {formatDateRange(r.dateDebut, r.dateFin)} · {CRENEAU_LABELS[r.creneau] || r.creneau}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {absence.affectationsImpactees && absence.affectationsImpactees.length > 0 && (
                            <div className="pt-1 space-y-1">
                              {absence.affectationsImpactees.map((a) => (
                                <div key={a.id} className="flex items-center gap-2 text-sm">
                                  <CalendarDaysIcon className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                                  <span className="text-gray-600">
                                    {a.collaborateurPrenom} {a.collaborateurNom}
                                  </span>
                                  {a.ecoleNom && (
                                    <span className="text-xs text-gray-400">— {a.ecoleNom}</span>
                                  )}
                                  <span className="text-xs text-gray-400">
                                    {formatDateRange(a.dateDebut, a.dateFin)} · {CRENEAU_LABELS[a.creneau as Creneau] || a.creneau}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {(!absence.remplacements || absence.remplacements.length === 0)
                            && (!absence.affectationsImpactees || absence.affectationsImpactees.length === 0)
                            && !absence.motifDetails && (
                            <p className="text-xs text-gray-400 pt-2">Aucun détail supplémentaire.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Remplaçant: modal absence */}
      {role === 'remplacant' && (
        <AbsenceModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSaveRemplacantAbsence}
        />
      )}
    </div>
  )
}
