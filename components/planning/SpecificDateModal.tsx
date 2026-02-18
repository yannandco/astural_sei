'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'
import { Creneau, CRENEAU_LABELS } from './types'

interface SpecificDateModalProps {
  remplacantId: number
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    date: string
    creneau: Creneau
    isAvailable: boolean
    note?: string
  }) => Promise<void>
  initialDate?: string
  initialCreneau?: Creneau
  mode: 'add_available' | 'add_exception'
}

export default function SpecificDateModal({
  remplacantId,
  isOpen,
  onClose,
  onSave,
  initialDate,
  initialCreneau,
  mode,
}: SpecificDateModalProps) {
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(initialDate || '')
  const [creneau, setCreneau] = useState<Creneau>(initialCreneau || 'journee')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (isOpen) {
      setDate(initialDate || '')
      setCreneau(initialCreneau || 'journee')
      setNote('')
    }
  }, [isOpen, initialDate, initialCreneau])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!date) return

    setSaving(true)
    try {
      await onSave({
        date,
        creneau,
        isAvailable: mode === 'add_available',
        note: note || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const title = mode === 'add_available'
    ? 'Ajouter disponibilité ponctuelle'
    : 'Ajouter exception (indisponible)'

  const description = mode === 'add_available'
    ? 'Ajoutez une disponibilité pour une date spécifique où le remplaçant est exceptionnellement disponible.'
    : 'Ajoutez une exception pour une date où le remplaçant est normalement disponible mais ne peut pas travailler.'

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-md overflow-visible">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="modal-close-button">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4 overflow-visible">
            <p className="text-sm text-gray-600">{description}</p>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">Date *</label>
              <DatePicker
                value={date}
                onChange={setDate}
                required
              />
            </div>

            {/* Créneau */}
            <div className="form-group">
              <label className="form-label">Créneau *</label>
              <select
                value={creneau}
                onChange={(e) => setCreneau(e.target.value as Creneau)}
                className="form-select"
                required
              >
                {Object.entries(CRENEAU_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div className="form-group">
              <label className="form-label">Note (optionnel)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="form-textarea"
                rows={2}
                placeholder={mode === 'add_exception' ? 'Ex: Rendez-vous médical' : 'Ex: Disponible exceptionnellement'}
              />
            </div>
          </div>

          <div className="modal-footer">
            <div className="modal-footer-actions">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || !date}
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
