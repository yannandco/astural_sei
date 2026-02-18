'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'
import { Creneau, CRENEAU_LABELS, MOTIF_LABELS } from './types'

interface AbsenceModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    dateDebut: string
    dateFin: string
    creneau: Creneau
    motif: string
    motifDetails?: string
  }) => Promise<void>
  editingAbsence?: {
    id: number
    dateDebut: string
    dateFin: string
    creneau: Creneau
    motif: string
    motifDetails: string | null
  }
  prefillDate?: string
  prefillCreneau?: Creneau
}

export default function AbsenceModal({
  isOpen,
  onClose,
  onSave,
  editingAbsence,
  prefillDate,
  prefillCreneau,
}: AbsenceModalProps) {
  const [saving, setSaving] = useState(false)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [creneau, setCreneau] = useState<Creneau>('journee')
  const [motif, setMotif] = useState('maladie')
  const [motifDetails, setMotifDetails] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (editingAbsence) {
        setDateDebut(editingAbsence.dateDebut)
        setDateFin(editingAbsence.dateFin)
        setCreneau(editingAbsence.creneau)
        setMotif(editingAbsence.motif)
        setMotifDetails(editingAbsence.motifDetails || '')
      } else {
        setDateDebut(prefillDate || '')
        setDateFin(prefillDate || '')
        setCreneau(prefillCreneau || 'journee')
        setMotif('maladie')
        setMotifDetails('')
      }
    }
  }, [isOpen, editingAbsence])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dateDebut || !dateFin) return

    setSaving(true)
    try {
      await onSave({
        dateDebut,
        dateFin,
        creneau,
        motif,
        motifDetails: motifDetails || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg overflow-visible">
        <div className="modal-header">
          <h3 className="modal-title">
            {editingAbsence ? 'Modifier l\'absence' : 'Nouvelle absence'}
          </h3>
          <button onClick={onClose} className="modal-close-button">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4 overflow-visible">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Date début *</label>
                <DatePicker
                  value={dateDebut}
                  onChange={setDateDebut}
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

            {/* Créneau */}
            {prefillCreneau ? (
              <div className="form-group">
                <label className="form-label">Créneau</label>
                <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {CRENEAU_LABELS[prefillCreneau]}
                </div>
              </div>
            ) : (
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
            )}

            {/* Motif */}
            <div className="form-group">
              <label className="form-label">Motif *</label>
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

            {/* Détails */}
            <div className="form-group">
              <label className="form-label">Détails (optionnel)</label>
              <textarea
                value={motifDetails}
                onChange={(e) => setMotifDetails(e.target.value)}
                className="form-textarea"
                rows={2}
                placeholder="Précisions sur l'absence..."
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
                disabled={saving || !dateDebut || !dateFin}
                className="btn btn-primary"
              >
                {saving ? 'Enregistrement...' : editingAbsence ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
