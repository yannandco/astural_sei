'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'
import {
  JourSemaine,
  Creneau,
  JOURS_SEMAINE,
  JOUR_LABELS,
  CRENEAU_LABELS,
  DisponibilitePeriode,
} from './types'

interface PeriodeScolaire {
  id: number
  code: string
  label: string
  dateDebut: string
  dateFin: string
}

interface PeriodeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    id?: number
    nom: string
    dateDebut: string
    dateFin: string
    recurrences: { jourSemaine: JourSemaine; creneau: Creneau }[]
  }) => Promise<void>
  periode?: DisponibilitePeriode | null
}

type DateMode = 'periode' | 'manuel'

export default function PeriodeModal({
  isOpen,
  onClose,
  onSave,
  periode,
}: PeriodeModalProps) {
  const [dateMode, setDateMode] = useState<DateMode>('manuel')
  const [selectedPeriodeId, setSelectedPeriodeId] = useState<number | null>(null)
  const [periodesScolaires, setPeriodesScolaires] = useState<PeriodeScolaire[]>([])
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [selectedRecurrences, setSelectedRecurrences] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingPeriodes, setLoadingPeriodes] = useState(false)

  // Fetch periodes scolaires on mount
  useEffect(() => {
    const fetchPeriodes = async () => {
      setLoadingPeriodes(true)
      try {
        const res = await fetch('/api/periodes-scolaires')
        if (res.ok) {
          const { data } = await res.json()
          setPeriodesScolaires(data || [])
        }
      } catch (err) {
        console.error('Error fetching periodes scolaires:', err)
      } finally {
        setLoadingPeriodes(false)
      }
    }
    fetchPeriodes()
  }, [])

  // Reset form when modal opens/closes or periode changes
  useEffect(() => {
    if (isOpen) {
      if (periode) {
        // Editing existing periode - check if it matches a periode scolaire
        const matchingPeriode = periodesScolaires.find(
          p => p.dateDebut === periode.dateDebut && p.dateFin === periode.dateFin
        )
        if (matchingPeriode) {
          setDateMode('periode')
          setSelectedPeriodeId(matchingPeriode.id)
        } else {
          setDateMode('manuel')
          setSelectedPeriodeId(null)
        }
        setDateDebut(periode.dateDebut)
        setDateFin(periode.dateFin)
        const recSet = new Set<string>()
        periode.recurrences.forEach((r) => {
          recSet.add(`${r.jourSemaine}-${r.creneau}`)
        })
        setSelectedRecurrences(recSet)
      } else {
        setDateMode('manuel')
        setSelectedPeriodeId(null)
        setDateDebut('')
        setDateFin('')
        setSelectedRecurrences(new Set())
      }
      setError(null)
    }
  }, [isOpen, periode, periodesScolaires])

  const handlePeriodeChange = (periodeId: number) => {
    const selected = periodesScolaires.find(p => p.id === periodeId)
    if (selected) {
      setSelectedPeriodeId(periodeId)
      setDateDebut(selected.dateDebut)
      setDateFin(selected.dateFin)
    }
  }

  const handleDateModeChange = (mode: DateMode) => {
    setDateMode(mode)
    if (mode === 'manuel') {
      setSelectedPeriodeId(null)
    }
  }

  const toggleRecurrence = (jour: JourSemaine, creneau: Creneau) => {
    const key = `${jour}-${creneau}`
    const newSet = new Set(selectedRecurrences)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setSelectedRecurrences(newSet)
  }

  const handleSubmit = async () => {
    setError(null)
    console.log('[PeriodeModal] handleSubmit appelé')

    if (!dateDebut || !dateFin) {
      setError('Les dates de début et fin sont requises')
      return
    }

    if (dateDebut > dateFin) {
      setError('La date de début doit être avant la date de fin')
      return
    }

    const recurrences: { jourSemaine: JourSemaine; creneau: Creneau }[] = []
    selectedRecurrences.forEach((key) => {
      const [jour, creneau] = key.split('-') as [JourSemaine, Creneau]
      recurrences.push({ jourSemaine: jour, creneau })
    })

    // Generate nom from periode scolaire or dates
    let nom = ''
    if (dateMode === 'periode' && selectedPeriodeId) {
      const selected = periodesScolaires.find(p => p.id === selectedPeriodeId)
      nom = selected?.label || ''
    }

    console.log('[PeriodeModal] Données à sauvegarder:', { nom, dateDebut, dateFin, recurrences })
    setSaving(true)
    try {
      await onSave({
        id: periode?.id,
        nom,
        dateDebut,
        dateFin,
        recurrences,
      })
      console.log('[PeriodeModal] Sauvegarde réussie')
    } catch (err) {
      console.error('[PeriodeModal] Erreur:', err)
      setError((err as Error).message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const creneauxSimples: Creneau[] = ['matin', 'apres_midi']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-2xl overflow-visible" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-lg font-semibold text-gray-900">
            {periode ? 'Modifier la période' : 'Nouvelle période de disponibilité'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div>
          <div className="modal-body space-y-4 overflow-visible">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Date mode selector */}
            <div className="form-group">
              <label className="form-label mb-2">Type de période</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dateMode"
                    checked={dateMode === 'periode'}
                    onChange={() => handleDateModeChange('periode')}
                    className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Période scolaire</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dateMode"
                    checked={dateMode === 'manuel'}
                    onChange={() => handleDateModeChange('manuel')}
                    className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Dates personnalisées</span>
                </label>
              </div>
            </div>

            {/* Periode scolaire selector */}
            {dateMode === 'periode' && (
              <div className="form-group">
                <label className="form-label">Période scolaire *</label>
                {loadingPeriodes ? (
                  <div className="py-2 text-gray-500 text-sm">Chargement...</div>
                ) : periodesScolaires.length === 0 ? (
                  <div className="py-2 text-gray-500 text-sm">Aucune période scolaire configurée</div>
                ) : (
                  <select
                    value={selectedPeriodeId || ''}
                    onChange={(e) => handlePeriodeChange(parseInt(e.target.value))}
                    className="form-input"
                  >
                    <option value="">Sélectionner une période...</option>
                    {periodesScolaires.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.label}
                      </option>
                    ))}
                  </select>
                )}
                {selectedPeriodeId && (
                  <p className="mt-1 text-xs text-gray-500">
                    Du {new Date(dateDebut).toLocaleDateString('fr-FR')} au {new Date(dateFin).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            )}

            {/* Manual date pickers */}
            {dateMode === 'manuel' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Date de début *</label>
                  <DatePicker
                    value={dateDebut}
                    onChange={setDateDebut}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date de fin *</label>
                  <DatePicker
                    value={dateFin}
                    onChange={setDateFin}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label mb-2">Jours et créneaux disponibles</label>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"></th>
                      {JOURS_SEMAINE.map((jour) => (
                        <th
                          key={jour}
                          className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase"
                        >
                          {JOUR_LABELS[jour]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {creneauxSimples.map((creneau) => (
                      <tr key={creneau} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-xs font-medium text-gray-600">
                          {CRENEAU_LABELS[creneau]}
                        </td>
                        {JOURS_SEMAINE.map((jour) => {
                          const key = `${jour}-${creneau}`
                          const checked = selectedRecurrences.has(key)

                          return (
                            <td key={key} className="px-3 py-2 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleRecurrence(jour, creneau)}
                                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                              </label>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Cochez les créneaux où le remplaçant est disponible pendant cette période
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={saving || (dateMode === 'periode' && !selectedPeriodeId)}
            >
              {saving ? 'Enregistrement...' : periode ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
