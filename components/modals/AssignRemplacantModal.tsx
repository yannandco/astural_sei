'use client'

import { useState, useEffect, useMemo } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface AbsenceEcole {
  id: number
  name: string
  joursPresence: string | null
  remplacementApresJours: number | null
  isRemplacee: boolean
  urgency: string
  joursRestants: number | null
}

interface RemplacantOption {
  id: number
  lastName: string
  firstName: string
}

const CRENEAU_LABELS: Record<string, string> = {
  matin: 'Matin',
  apres_midi: 'Après-midi',
  journee: 'Journée',
}

const MOTIF_LABELS: Record<string, string> = {
  maladie: 'Maladie',
  conge: 'Congé',
  formation: 'Formation',
  autre: 'Autre',
}

interface AssignRemplacantModalProps {
  isOpen: boolean
  onClose: () => void
  personFirstName: string | null
  personLastName: string | null
  dateDebut: string
  dateFin: string
  creneau: string
  motif: string
  ecoles: AbsenceEcole[]
  preSelectedRemplacant?: { id: number; lastName: string; firstName: string } | null
  onAssign: (remplacantId: number, ecoleId: number) => Promise<void>
  assigningLoading: boolean
}

export default function AssignRemplacantModal({
  isOpen,
  onClose,
  personFirstName,
  personLastName,
  dateDebut,
  dateFin,
  creneau,
  motif,
  ecoles,
  preSelectedRemplacant,
  onAssign,
  assigningLoading,
}: AssignRemplacantModalProps) {
  const [remplacantsList, setRemplacantsList] = useState<RemplacantOption[]>([])
  const [selectedRemplacantId, setSelectedRemplacantId] = useState('')
  const [selectedEcoleId, setSelectedEcoleId] = useState('')
  const [remplacantSearch, setRemplacantSearch] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setSelectedRemplacantId(preSelectedRemplacant ? preSelectedRemplacant.id.toString() : '')
    setRemplacantSearch('')
    setSelectedEcoleId(ecoles.length === 1 ? ecoles[0].id.toString() : '')

    if (!preSelectedRemplacant) {
      fetch('/api/remplacants?isActive=true')
        .then(res => res.json())
        .then(data => {
          setRemplacantsList(
            (data.data || []).map((r: RemplacantOption) => ({
              id: r.id,
              lastName: r.lastName,
              firstName: r.firstName,
            }))
          )
        })
        .catch(error => console.error('Error fetching remplacants:', error))
    }
  }, [isOpen, ecoles, preSelectedRemplacant])

  const filteredRemplacants = useMemo(() => {
    if (!remplacantSearch.trim()) return remplacantsList
    const q = remplacantSearch.toLowerCase()
    return remplacantsList.filter(
      (r) => r.lastName.toLowerCase().includes(q) || r.firstName.toLowerCase().includes(q)
    )
  }, [remplacantsList, remplacantSearch])

  const selectedRemplacant = useMemo(() => {
    if (preSelectedRemplacant) return preSelectedRemplacant
    if (!selectedRemplacantId) return null
    return remplacantsList.find((r) => r.id.toString() === selectedRemplacantId) || null
  }, [remplacantsList, selectedRemplacantId, preSelectedRemplacant])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const handleSubmit = async () => {
    const remplacantId = preSelectedRemplacant ? preSelectedRemplacant.id : parseInt(selectedRemplacantId)
    const ecoleId = parseInt(selectedEcoleId)
    if (!remplacantId || !ecoleId) {
      alert('Veuillez sélectionner un remplaçant et une école')
      return
    }
    await onAssign(remplacantId, ecoleId)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg">
        <div className="modal-header">
          <h3 className="text-lg font-semibold">Affecter un remplaçant</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="font-medium text-gray-900">
                {personLastName?.toUpperCase()} {personFirstName}
              </div>
              <div className="text-gray-600 mt-1">
                {formatDate(dateDebut)}
                {dateDebut !== dateFin && ` → ${formatDate(dateFin)}`}
                {' • '}{CRENEAU_LABELS[creneau]}
                {' • '}{MOTIF_LABELS[motif]}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Remplaçant {!preSelectedRemplacant && '*'}</label>
              {selectedRemplacant ? (
                <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-purple-800">
                    {selectedRemplacant.lastName.toUpperCase()} {selectedRemplacant.firstName}
                  </span>
                  {!preSelectedRemplacant && (
                    <button
                      type="button"
                      onClick={() => { setSelectedRemplacantId(''); setRemplacantSearch('') }}
                      className="text-purple-400 hover:text-purple-600"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un remplaçant..."
                      value={remplacantSearch}
                      onChange={(e) => setRemplacantSearch(e.target.value)}
                      className="form-input pl-9"
                      autoFocus
                    />
                  </div>
                  <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredRemplacants.length === 0 ? (
                      <p className="text-sm text-gray-500 p-3 text-center">Aucun remplaçant trouvé</p>
                    ) : (
                      filteredRemplacants.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { setSelectedRemplacantId(r.id.toString()); setRemplacantSearch('') }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <span className="font-medium text-gray-900">{r.lastName.toUpperCase()}</span>{' '}
                          <span className="text-gray-600">{r.firstName}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">École *</label>
              {ecoles.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucune école associée à ce collaborateur</p>
              ) : (
                <>
                  <select
                    value={selectedEcoleId}
                    onChange={(e) => setSelectedEcoleId(e.target.value)}
                    className="form-input"
                  >
                    {ecoles.length > 1 && (
                      <option value="">-- Sélectionner une école --</option>
                    )}
                    {ecoles.map((ecole) => (
                      <option key={ecole.id} value={ecole.id}>
                        {ecole.name}
                      </option>
                    ))}
                  </select>
                  {selectedEcoleId && (() => {
                    const ecole = ecoles.find(e => e.id.toString() === selectedEcoleId)
                    if (!ecole || ecole.remplacementApresJours == null) return null
                    return (
                      <div className={`mt-2 text-xs px-2 py-1 rounded ${
                        ecole.urgency === 'urgent' ? 'bg-red-50 text-red-700' :
                        ecole.urgency === 'warning' ? 'bg-amber-50 text-amber-700' :
                        ecole.urgency === 'normal' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        Délai de remplacement : {ecole.remplacementApresJours} jour{Number(ecole.remplacementApresJours) > 1 ? 's' : ''}
                        {ecole.joursRestants !== null && (
                          <> ({ecole.joursRestants < 0 ? `${Math.abs(ecole.joursRestants)}j de retard` : `${ecole.joursRestants}j restant`})</>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <div></div>
          <div className="modal-footer-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={assigningLoading || (!preSelectedRemplacant && !selectedRemplacantId) || !selectedEcoleId}
              className="btn btn-primary"
            >
              {assigningLoading ? 'Affectation...' : 'Affecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
