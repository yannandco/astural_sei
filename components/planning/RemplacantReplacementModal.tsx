'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'
import {
  Creneau, CRENEAU_LABELS, MOTIF_LABELS, JOUR_LABELS,
  JourSemaine, getJourSemaine, formatDate,
} from './types'

interface JourPresence {
  jour: JourSemaine
  creneau: Creneau
}

interface CollaborateurPresence {
  ecoleId: number
  ecoleName: string
  joursPresence: JourPresence[]
}

interface CollaborateurOption {
  id: number
  lastName: string
  firstName: string
}

interface ReplacementEntry {
  date: string
  jour: JourSemaine
  creneau: Creneau
  ecoleId: number
  ecoleName: string
}

interface RemplacantReplacementModalProps {
  remplacantId: number
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    collaborateurId: number
    remplacantId: number
    dateDebut: string
    dateFin: string
    entries: { ecoleId: number; date: string; creneau: Creneau }[]
    motif: string
    motifDetails?: string
  }) => Promise<void>
  prefillDate?: string
  prefillCreneau?: Creneau
}

export default function RemplacantReplacementModal({
  remplacantId,
  isOpen,
  onClose,
  onSave,
  prefillDate,
  prefillCreneau,
}: RemplacantReplacementModalProps) {
  const [saving, setSaving] = useState(false)
  const [loadingCollaborateurs, setLoadingCollaborateurs] = useState(false)
  const [loadingPresences, setLoadingPresences] = useState(false)

  // Data
  const [collaborateurs, setCollaborateurs] = useState<CollaborateurOption[]>([])
  const [presences, setPresences] = useState<CollaborateurPresence[]>([])

  // Form state
  const [collaborateurId, setCollaborateurId] = useState<number | ''>('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [motif, setMotif] = useState('maladie')
  const [motifDetails, setMotifDetails] = useState('')

  // Search
  const [searchCollab, setSearchCollab] = useState('')

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

  // Fetch collaborateurs list
  const fetchCollaborateurs = useCallback(async () => {
    setLoadingCollaborateurs(true)
    try {
      const res = await fetch('/api/collaborateurs?isActive=true')
      if (res.ok) {
        const { data } = await res.json()
        setCollaborateurs(data || [])
      }
    } finally {
      setLoadingCollaborateurs(false)
    }
  }, [])

  // Fetch collaborateur presences when selected
  const fetchPresences = useCallback(async (collabId: number) => {
    setLoadingPresences(true)
    try {
      const res = await fetch(`/api/collaborateurs/${collabId}/planning`)
      if (res.ok) {
        const { data } = await res.json()
        setPresences(data.presences || [])
      }
    } finally {
      setLoadingPresences(false)
    }
  }, [])

  // Init on open
  useEffect(() => {
    if (isOpen) {
      setCollaborateurId('')
      setDateDebut(prefillDate || '')
      setDateFin(prefillDate || '')
      setMotif('maladie')
      setMotifDetails('')
      setSearchCollab('')
      setPresences([])
      fetchCollaborateurs()
    }
  }, [isOpen, prefillDate, fetchCollaborateurs])

  // Fetch presences when collaborateur changes
  useEffect(() => {
    if (collaborateurId) {
      fetchPresences(collaborateurId as number)
    } else {
      setPresences([])
    }
  }, [collaborateurId, fetchPresences])

  // Filtered collaborateurs
  const filteredCollaborateurs = useMemo(() => {
    return collaborateurs.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchCollab.toLowerCase())
    )
  }, [collaborateurs, searchCollab])

  const selectedCollab = collaborateurId
    ? collaborateurs.find(c => c.id === collaborateurId)
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!collaborateurId || computedEntries.length === 0) return

    setSaving(true)
    try {
      await onSave({
        collaborateurId: collaborateurId as number,
        remplacantId,
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
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const jourOrder: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg overflow-visible">
        <div className="modal-header">
          <h3 className="modal-title">Annoncer un remplacement</h3>
          <button onClick={onClose} className="modal-close-button">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4 overflow-visible">
            {/* Collaborateur */}
            <div className="form-group">
              <label className="form-label">Collaborateur remplacé *</label>
              {collaborateurId && selectedCollab ? (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-blue-800 flex-1">
                    {selectedCollab.firstName} {selectedCollab.lastName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCollaborateurId('')
                      setSearchCollab('')
                      setPresences([])
                    }}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Rechercher un collaborateur..."
                    value={searchCollab}
                    onChange={(e) => setSearchCollab(e.target.value)}
                    className="form-input"
                  />
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-52 overflow-y-auto">
                    {loadingCollaborateurs ? (
                      <div className="px-3 py-4 text-sm text-gray-400 text-center">Chargement...</div>
                    ) : filteredCollaborateurs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400 italic">Aucun résultat</div>
                    ) : (
                      filteredCollaborateurs.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCollaborateurId(c.id)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <span className="font-medium text-gray-900">{c.firstName}</span>{' '}
                          <span className="text-gray-700">{c.lastName}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Dates — only after collaborateur is selected */}
            {collaborateurId && (
              <>
                {loadingPresences ? (
                  <div className="text-sm text-gray-400 text-center py-2">Chargement des présences...</div>
                ) : presences.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    Ce collaborateur n&apos;a aucune présence configurée.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">Date début *</label>
                        <DatePicker
                          value={dateDebut}
                          onChange={(v) => {
                            setDateDebut(v)
                            if (!dateFin || v > dateFin) setDateFin(v)
                          }}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date fin *</label>
                        <DatePicker
                          value={dateFin}
                          onChange={setDateFin}
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

                    {/* Motif */}
                    <div className="form-group">
                      <label className="form-label">Motif de l&apos;absence *</label>
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
                disabled={saving || !collaborateurId || computedEntries.length === 0}
                className="btn btn-primary"
              >
                {saving ? 'Enregistrement...' : 'Créer le remplacement'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
