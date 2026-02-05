'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'
import { Creneau, CRENEAU_LABELS, Affectation } from './types'

interface Collaborateur {
  id: number
  lastName: string
  firstName: string
}

interface Ecole {
  id: number
  name: string
}

interface AssignmentModalProps {
  remplacantId: number
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    collaborateurId: number
    ecoleId: number
    dateDebut: string
    dateFin: string
    creneau: Creneau
    motif?: string
  }) => Promise<void>
  initialDate?: string
  initialCreneau?: Creneau
  editingAffectation?: Affectation
}

export default function AssignmentModal({
  remplacantId,
  isOpen,
  onClose,
  onSave,
  initialDate,
  initialCreneau,
  editingAffectation,
}: AssignmentModalProps) {
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([])
  const [ecoles, setEcoles] = useState<Ecole[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [collaborateurId, setCollaborateurId] = useState<number | ''>('')
  const [ecoleId, setEcoleId] = useState<number | ''>('')
  const [dateDebut, setDateDebut] = useState(initialDate || '')
  const [dateFin, setDateFin] = useState(initialDate || '')
  const [creneau, setCreneau] = useState<Creneau>(initialCreneau || 'journee')
  const [motif, setMotif] = useState('')

  const [searchCollab, setSearchCollab] = useState('')
  const [searchEcole, setSearchEcole] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchData()
      if (editingAffectation) {
        setCollaborateurId(editingAffectation.collaborateurId)
        setEcoleId(editingAffectation.ecoleId)
        setDateDebut(editingAffectation.dateDebut)
        setDateFin(editingAffectation.dateFin)
        setCreneau(editingAffectation.creneau)
        setMotif(editingAffectation.motif || '')
      } else {
        setCollaborateurId('')
        setEcoleId('')
        setDateDebut(initialDate || '')
        setDateFin(initialDate || '')
        setCreneau(initialCreneau || 'journee')
        setMotif('')
      }
    }
  }, [isOpen, editingAffectation, initialDate, initialCreneau])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [collabRes, ecoleRes] = await Promise.all([
        fetch('/api/collaborateurs?isActive=true'),
        fetch('/api/ecoles?isActive=true'),
      ])

      if (collabRes.ok) {
        const { data } = await collabRes.json()
        setCollaborateurs(data)
      }

      if (ecoleRes.ok) {
        const { data } = await ecoleRes.json()
        setEcoles(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!collaborateurId || !ecoleId || !dateDebut || !dateFin) {
      return
    }

    setSaving(true)
    try {
      await onSave({
        collaborateurId: collaborateurId as number,
        ecoleId: ecoleId as number,
        dateDebut,
        dateFin,
        creneau,
        motif: motif || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const filteredCollaborateurs = collaborateurs.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchCollab.toLowerCase())
  )

  const filteredEcoles = ecoles.filter((e) =>
    e.name.toLowerCase().includes(searchEcole.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg">
        <div className="modal-header">
          <h3 className="modal-title">
            {editingAffectation ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
          </h3>
          <button onClick={onClose} className="modal-close-button">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : (
              <>
                {/* Collaborateur */}
                <div className="form-group">
                  <label className="form-label">Collaborateur remplacé *</label>
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchCollab}
                    onChange={(e) => setSearchCollab(e.target.value)}
                    className="form-input mb-2"
                  />
                  <select
                    value={collaborateurId}
                    onChange={(e) => setCollaborateurId(e.target.value ? parseInt(e.target.value) : '')}
                    className="form-select"
                    required
                  >
                    <option value="">Sélectionner un collaborateur</option>
                    {filteredCollaborateurs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* École */}
                <div className="form-group">
                  <label className="form-label">École *</label>
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchEcole}
                    onChange={(e) => setSearchEcole(e.target.value)}
                    className="form-input mb-2"
                  />
                  <select
                    value={ecoleId}
                    onChange={(e) => setEcoleId(e.target.value ? parseInt(e.target.value) : '')}
                    className="form-select"
                    required
                  >
                    <option value="">Sélectionner une école</option>
                    {filteredEcoles.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

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

                {/* Motif */}
                <div className="form-group">
                  <label className="form-label">Motif (optionnel)</label>
                  <textarea
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    className="form-textarea"
                    rows={2}
                    placeholder="Ex: Congé maladie, Formation..."
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
                disabled={loading || saving || !collaborateurId || !ecoleId || !dateDebut || !dateFin}
                className="btn btn-primary"
              >
                {saving ? 'Enregistrement...' : editingAffectation ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
