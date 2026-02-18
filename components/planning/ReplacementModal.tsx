'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'
import {
  Creneau, CRENEAU_LABELS, MOTIF_LABELS, JOUR_LABELS,
  JourSemaine, getJourSemaine, formatDate,
  calculateCellStatusWithPeriodes,
  DisponibilitePeriode, DisponibiliteSpecifique, Affectation,
} from './types'

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

interface ReplacementEntry {
  date: string
  jour: JourSemaine
  creneau: Creneau
  ecoleId: number
  ecoleName: string
}

interface PlanningRemplacant {
  id: number
  lastName: string
  firstName: string
  periodes: DisponibilitePeriode[]
  specifiques: DisponibiliteSpecifique[]
  affectations: Affectation[]
}

interface RemplacantWithAvailability {
  id: number
  lastName: string
  firstName: string
  availableCount: number
  totalCount: number
  isFullyAvailable: boolean
}

interface ReplacementModalProps {
  collaborateurId: number
  presences: Presence[]
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    remplacantId: number
    dateDebut: string
    dateFin: string
    entries: { ecoleId: number; date: string; creneau: Creneau }[]
    motif: string
    motifDetails?: string
  }) => Promise<void>
  onUpdate?: (data: { affectationId: number; remplacantId: number }) => Promise<void>
  editingRemplacement?: Remplacement
  prefillDate?: string
}

export default function ReplacementModal({
  collaborateurId,
  presences,
  isOpen,
  onClose,
  onSave,
  onUpdate,
  editingRemplacement,
  prefillDate,
}: ReplacementModalProps) {
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [planningData, setPlanningData] = useState<PlanningRemplacant[]>([])

  // Form state
  const [remplacantId, setRemplacantId] = useState<number | ''>('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [motif, setMotif] = useState('maladie')
  const [motifDetails, setMotifDetails] = useState('')

  // Search
  const [searchRemplacant, setSearchRemplacant] = useState('')

  const isEditMode = !!editingRemplacement

  // Build a map: jour -> [{creneau, ecoleId, ecoleName}]
  const presenceByJour = useMemo(() => {
    const map = new Map<JourSemaine, { creneau: Creneau; ecoleId: number; ecoleName: string }[]>()
    for (const p of presences) {
      for (const jp of p.joursPresence) {
        const existing = map.get(jp.jour) || []
        existing.push({ creneau: jp.creneau, ecoleId: p.ecoleId, ecoleName: p.ecoleName })
        map.set(jp.jour, existing)
      }
    }
    return map
  }, [presences])

  // Compute individual entries: one per (date, creneau, ecole)
  const computedEntries = useMemo((): ReplacementEntry[] => {
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
          const dateStr = formatDate(current)

          for (const slot of presenceSlots) {
            entries.push({
              date: dateStr,
              jour,
              creneau: slot.creneau,
              ecoleId: slot.ecoleId,
              ecoleName: slot.ecoleName,
            })
          }
        }
      }
      current.setDate(current.getDate() + 1)
    }

    return entries
  }, [dateDebut, dateFin, presenceByJour])

  // Group entries by jour for display
  const entriesByJour = useMemo(() => {
    const map = new Map<JourSemaine, { creneau: Creneau; ecoleName: string }[]>()
    for (const entry of computedEntries) {
      if (!map.has(entry.jour)) {
        map.set(entry.jour, [])
      }
    }
    for (const p of presences) {
      for (const jp of p.joursPresence) {
        const existing = map.get(jp.jour)
        if (existing && !existing.some(e => e.creneau === jp.creneau)) {
          existing.push({ creneau: jp.creneau, ecoleName: p.ecoleName })
        }
      }
    }
    return map
  }, [computedEntries, presences])

  // Fetch planning data for availability
  const fetchAvailability = useCallback(async (start: string, end: string) => {
    setLoadingAvailability(true)
    try {
      const res = await fetch(`/api/planning?startDate=${start}&endDate=${end}`)
      if (res.ok) {
        const { data } = await res.json()
        setPlanningData(data || [])
      }
    } finally {
      setLoadingAvailability(false)
    }
  }, [])

  // Compute availability for each remplaçant
  const remplacantsWithAvailability = useMemo((): RemplacantWithAvailability[] => {
    if (computedEntries.length === 0 || planningData.length === 0) {
      return planningData.map(r => ({
        id: r.id,
        lastName: r.lastName,
        firstName: r.firstName,
        availableCount: 0,
        totalCount: 0,
        isFullyAvailable: false,
      }))
    }

    return planningData.map(r => {
      let availableCount = 0
      for (const entry of computedEntries) {
        const { status } = calculateCellStatusWithPeriodes(
          entry.date,
          entry.creneau,
          r.periodes,
          r.specifiques,
          r.affectations,
        )
        if (status === 'disponible_recurrent' || status === 'disponible_specifique') {
          availableCount++
        }
      }

      return {
        id: r.id,
        lastName: r.lastName,
        firstName: r.firstName,
        availableCount,
        totalCount: computedEntries.length,
        isFullyAvailable: availableCount === computedEntries.length,
      }
    })
  }, [planningData, computedEntries])

  // Sort: fully available first, then by availability count desc, then alphabetical
  const sortedRemplacants = useMemo(() => {
    const filtered = remplacantsWithAvailability.filter((r) =>
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(searchRemplacant.toLowerCase())
    )
    return filtered.sort((a, b) => {
      if (a.isFullyAvailable !== b.isFullyAvailable) return a.isFullyAvailable ? -1 : 1
      if (a.availableCount !== b.availableCount) return b.availableCount - a.availableCount
      return `${a.lastName}`.localeCompare(`${b.lastName}`)
    })
  }, [remplacantsWithAvailability, searchRemplacant])

  // Fetch availability when entries change
  useEffect(() => {
    if (isOpen && dateDebut && dateFin && computedEntries.length > 0) {
      fetchAvailability(dateDebut, dateFin)
    }
  }, [isOpen, dateDebut, dateFin, computedEntries.length, fetchAvailability])

  useEffect(() => {
    if (isOpen) {
      if (editingRemplacement) {
        setRemplacantId(editingRemplacement.remplacantId)
        setSearchRemplacant('')
        // Fetch all remplaçants for edit mode
        fetchAvailability(editingRemplacement.dateDebut, editingRemplacement.dateFin)
      } else {
        setRemplacantId('')
        setDateDebut(prefillDate || '')
        setDateFin(prefillDate || '')
        setMotif('maladie')
        setMotifDetails('')
        setSearchRemplacant('')
        setPlanningData([])
      }
    }
  }, [isOpen, editingRemplacement])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!remplacantId) return

    setSaving(true)
    try {
      if (isEditMode && onUpdate) {
        await onUpdate({
          affectationId: editingRemplacement!.id,
          remplacantId: remplacantId as number,
        })
      } else {
        if (computedEntries.length === 0) return

        await onSave({
          remplacantId: remplacantId as number,
          dateDebut,
          dateFin,
          entries: computedEntries.map(e => ({
            ecoleId: e.ecoleId,
            date: e.date,
            creneau: e.creneau,
          })),
          motif,
          motifDetails: motifDetails || undefined,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const jourOrder: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']

  const selectedRemplacant = remplacantId
    ? remplacantsWithAvailability.find(r => r.id === remplacantId) || planningData.find(r => r.id === remplacantId)
    : null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg overflow-visible">
        <div className="modal-header">
          <h3 className="modal-title">
            {isEditMode ? 'Changer le remplaçant' : 'Annoncer un remplacement'}
          </h3>
          <button onClick={onClose} className="modal-close-button">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4 overflow-visible">
            {/* Mode édition: afficher les infos du remplacement actuel */}
            {isEditMode && editingRemplacement && (
              <div className="bg-purple-50 rounded-lg p-3 text-sm">
                <div className="font-medium text-purple-800">
                  {new Date(editingRemplacement.dateDebut).toLocaleDateString('fr-FR')}
                  {editingRemplacement.dateDebut !== editingRemplacement.dateFin && ` - ${new Date(editingRemplacement.dateFin).toLocaleDateString('fr-FR')}`}
                  {' \u2022 '}{CRENEAU_LABELS[editingRemplacement.creneau]}
                </div>
                <div className="text-purple-600">
                  {editingRemplacement.ecoleNom}
                </div>
              </div>
            )}

            {/* Champs uniquement en mode création */}
            {!isEditMode && (
              <>
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Date début *</label>
                    <DatePicker
                      value={dateDebut}
                      onChange={(v) => {
                        setDateDebut(v)
                        if (!dateFin || v > dateFin) setDateFin(v)
                        setRemplacantId('')
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date fin *</label>
                    <DatePicker
                      value={dateFin}
                      onChange={(v) => {
                        setDateFin(v)
                        setRemplacantId('')
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Preview des créneaux détectés */}
                {dateDebut && dateFin && (
                  <div className="form-group">
                    <label className="form-label">Créneaux détectés</label>
                    {computedEntries.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                        Aucun créneau de présence trouvé sur cette période.
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex flex-wrap gap-2">
                          {jourOrder
                            .filter(j => entriesByJour.has(j))
                            .map(jour => {
                              const slots = entriesByJour.get(jour)!
                              return (
                                <div key={jour} className="bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs">
                                  <div className="font-medium text-gray-800">{JOUR_LABELS[jour]}</div>
                                  {slots.map((s, i) => (
                                    <div key={i} className="text-gray-500">
                                      {CRENEAU_LABELS[s.creneau]} — {s.ecoleName}
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Remplaçant — shown after dates in creation, or first in edit mode */}
            <div className="form-group">
              <label className="form-label">Remplaçant *</label>
              {remplacantId && selectedRemplacant ? (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-purple-800 flex-1">
                    {('firstName' in selectedRemplacant ? selectedRemplacant.firstName : '')} {selectedRemplacant.lastName}
                    {'availableCount' in selectedRemplacant && selectedRemplacant.totalCount > 0 && (
                      <span className={`ml-2 text-xs ${selectedRemplacant.isFullyAvailable ? 'text-green-600' : 'text-orange-600'}`}>
                        ({selectedRemplacant.availableCount}/{selectedRemplacant.totalCount} créneaux)
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setRemplacantId(''); setSearchRemplacant('') }}
                    className="text-purple-400 hover:text-purple-600"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  {!isEditMode && computedEntries.length === 0 ? (
                    <div className="text-sm text-gray-400 italic">Sélectionnez d'abord les dates</div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Rechercher un remplaçant..."
                        value={searchRemplacant}
                        onChange={(e) => setSearchRemplacant(e.target.value)}
                        className="form-input"
                      />
                      <div className="mt-1 border border-gray-200 rounded-lg max-h-52 overflow-y-auto">
                        {loadingAvailability ? (
                          <div className="px-3 py-4 text-sm text-gray-400 text-center">Chargement des disponibilités...</div>
                        ) : sortedRemplacants.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400 italic">Aucun résultat</div>
                        ) : (
                          sortedRemplacants.map((r) => {
                            const hasEntries = r.totalCount > 0
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setRemplacantId(r.id)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                              >
                                {hasEntries && (
                                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${
                                    r.isFullyAvailable ? 'bg-green-500' : r.availableCount > 0 ? 'bg-orange-400' : 'bg-gray-300'
                                  }`} />
                                )}
                                <span className="flex-1">
                                  <span className="font-medium text-gray-900">{r.firstName}</span>{' '}
                                  <span className="text-gray-700">{r.lastName}</span>
                                </span>
                                {hasEntries && (
                                  <span className={`text-xs flex-shrink-0 ${
                                    r.isFullyAvailable ? 'text-green-600' : r.availableCount > 0 ? 'text-orange-600' : 'text-gray-400'
                                  }`}>
                                    {r.availableCount}/{r.totalCount}
                                  </span>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Motif + Détails en mode création */}
            {!isEditMode && (
              <>
                <div className="form-group">
                  <label className="form-label">Motif de l'absence *</label>
                  <select
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    className="form-select"
                    required
                  >
                    {Object.entries(MOTIF_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Détails (optionnel)</label>
                  <textarea
                    value={motifDetails}
                    onChange={(e) => setMotifDetails(e.target.value)}
                    className="form-textarea"
                    rows={2}
                    placeholder="Précisions..."
                  />
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <div className="modal-footer-actions">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Annuler
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  loadingData ||
                  !remplacantId ||
                  (!isEditMode && computedEntries.length === 0)
                }
                className="btn btn-primary"
              >
                {saving ? 'Enregistrement...' : isEditMode ? 'Changer le remplaçant' : 'Créer le remplacement'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
