'use client'

import { useState, useMemo } from 'react'
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { DateRangePicker } from '@/components/ui'
import { JourSemaine, Creneau, JOUR_LABELS, CRENEAU_LABELS, JOURS_CALENDRIER, getJourSemaine, formatDate } from './types'

interface DisponibiliteModalProps {
  remplacantId: number
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  prefillDate?: string
  prefillDateFin?: string
}

const CRENEAUX_DISPLAY: Creneau[] = ['matin', 'apres_midi']

export default function DisponibiliteModal({
  remplacantId,
  isOpen,
  onClose,
  onSave,
  prefillDate,
  prefillDateFin,
}: DisponibiliteModalProps) {
  const [dateDebut, setDateDebut] = useState(prefillDate || '')
  const [dateFin, setDateFin] = useState(prefillDateFin || prefillDate || '')
  const [isAvailable, setIsAvailable] = useState(true)
  const [saving, setSaving] = useState(false)

  // Grid state: jour -> set of creneaux
  const [selectedSlots, setSelectedSlots] = useState<Map<JourSemaine, Set<Creneau>>>(new Map())

  const toggleSlot = (jour: JourSemaine, creneau: Creneau) => {
    setSelectedSlots(prev => {
      const next = new Map(prev)
      const creneaux = new Set(next.get(jour) || [])
      if (creneaux.has(creneau)) {
        creneaux.delete(creneau)
      } else {
        creneaux.add(creneau)
      }
      if (creneaux.size === 0) {
        next.delete(jour)
      } else {
        next.set(jour, creneaux)
      }
      return next
    })
  }

  const isSlotSelected = (jour: JourSemaine, creneau: Creneau) => {
    return selectedSlots.get(jour)?.has(creneau) || false
  }

  // Count total selected slots
  const selectedCount = useMemo(() => {
    let count = 0
    for (const creneaux of selectedSlots.values()) {
      count += creneaux.size
    }
    return count
  }, [selectedSlots])

  // Compute how many specific entries will be created
  const entriesToCreate = useMemo(() => {
    if (!dateDebut || !dateFin || dateDebut > dateFin || selectedCount === 0) return 0

    let count = 0
    const start = new Date(dateDebut + 'T00:00:00')
    const end = new Date(dateFin + 'T00:00:00')
    const current = new Date(start)

    while (current <= end) {
      const dayOfWeek = current.getDay()
      // Skip samedi (6), dimanche (0), mercredi (3)
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && dayOfWeek !== 3) {
        const jour = getJourSemaine(current)
        if (jour && selectedSlots.has(jour)) {
          count += selectedSlots.get(jour)!.size
        }
      }
      current.setDate(current.getDate() + 1)
    }

    return count
  }, [dateDebut, dateFin, selectedSlots, selectedCount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dateDebut || !dateFin || selectedCount === 0) return

    setSaving(true)
    try {
      const start = new Date(dateDebut + 'T00:00:00')
      const end = new Date(dateFin + 'T00:00:00')
      const current = new Date(start)

      const requests: Promise<Response>[] = []

      while (current <= end) {
        const dayOfWeek = current.getDay()
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && dayOfWeek !== 3) {
          const jour = getJourSemaine(current)
          if (jour && selectedSlots.has(jour)) {
            const dateStr = formatDate(current)
            for (const creneau of selectedSlots.get(jour)!) {
              requests.push(
                fetch(`/api/remplacants/${remplacantId}/disponibilites/specifiques`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ date: dateStr, creneau, isAvailable }),
                })
              )
            }
          }
        }
        current.setDate(current.getDate() + 1)
      }

      await Promise.all(requests)
      onSave()
      onClose()
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg overflow-visible">
        <div className="modal-header">
          <h3 className="modal-title">Gérer les disponibilités</h3>
          <button onClick={onClose} className="modal-close-button">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4 overflow-visible">
            {/* Date range */}
            <div className="form-group">
              <label className="form-label">Période *</label>
              <DateRangePicker
                valueStart={dateDebut}
                valueEnd={dateFin}
                onChangeStart={setDateDebut}
                onChangeEnd={setDateFin}
                required
              />
            </div>

            {/* Toggle disponible/indisponible */}
            <div className="form-group">
              <label className="form-label">Statut</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAvailable(true)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    isAvailable
                      ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Disponible
                </button>
                <button
                  type="button"
                  onClick={() => setIsAvailable(false)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    !isAvailable
                      ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Indisponible
                </button>
              </div>
            </div>

            {/* Day x Creneau grid */}
            <div className="form-group">
              <label className="form-label">Créneaux *</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                      {JOURS_CALENDRIER.map(jour => (
                        <th key={jour} className="py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase">
                          {JOUR_LABELS[jour]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CRENEAUX_DISPLAY.map(creneau => (
                      <tr key={creneau} className="border-t border-gray-100">
                        <td className="py-2 px-3 text-xs font-medium text-gray-600">
                          {CRENEAU_LABELS[creneau]}
                        </td>
                        {JOURS_CALENDRIER.map(jour => {
                          const selected = isSlotSelected(jour, creneau)
                          return (
                            <td key={`${jour}-${creneau}`} className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSlot(jour, creneau)}
                                className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center ${
                                  selected
                                    ? isAvailable
                                      ? 'bg-green-100 border-green-400 text-green-700'
                                      : 'bg-red-100 border-red-400 text-red-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-300 hover:border-gray-400'
                                }`}
                              >
                                {selected && <CheckIcon className="w-5 h-5" />}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Counter */}
              {selectedCount > 0 && dateDebut && dateFin && (
                <p className="mt-2 text-sm text-gray-600">
                  {selectedCount} créneau{selectedCount > 1 ? 'x' : ''} par semaine
                  {entriesToCreate > 0 && (
                    <span className="text-gray-400"> — {entriesToCreate} entrée{entriesToCreate > 1 ? 's' : ''} au total</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <div className="modal-footer-actions">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || selectedCount === 0 || !dateDebut || !dateFin}
                className="btn btn-primary"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
