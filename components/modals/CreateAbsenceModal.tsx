'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { DateRangePicker } from '@/components/ui'

interface CreateAbsenceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateAbsenceModal({ isOpen, onClose, onSuccess }: CreateAbsenceModalProps) {
  const router = useRouter()
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [createPersonType, setCreatePersonType] = useState<'collaborateur' | 'remplacant'>('collaborateur')
  const [createPersonSearch, setCreatePersonSearch] = useState('')
  const [createPersonResults, setCreatePersonResults] = useState<{ id: number; firstName: string; lastName: string }[]>([])
  const [createPersonLoading, setCreatePersonLoading] = useState(false)
  const [createSelectedPerson, setCreateSelectedPerson] = useState<{ id: number; firstName: string; lastName: string } | null>(null)
  const [createDateDebut, setCreateDateDebut] = useState('')
  const [createDateFin, setCreateDateFin] = useState('')
  const [createCreneau, setCreateCreneau] = useState<'matin' | 'apres_midi' | 'journee'>('journee')
  const [createMotif, setCreateMotif] = useState('maladie')
  const [createMotifDetails, setCreateMotifDetails] = useState('')
  const [createSaving, setCreateSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCreateStep(1)
      setCreatePersonType('collaborateur')
      setCreatePersonSearch('')
      setCreatePersonResults([])
      setCreateSelectedPerson(null)
      setCreateDateDebut('')
      setCreateDateFin('')
      setCreateCreneau('journee')
      setCreateMotif('maladie')
      setCreateMotifDetails('')
    }
  }, [isOpen])

  // Debounced person search
  useEffect(() => {
    if (!isOpen || createStep !== 1) return
    if (!createPersonSearch.trim()) {
      setCreatePersonResults([])
      return
    }

    setCreatePersonLoading(true)
    const timer = setTimeout(async () => {
      try {
        const endpoint = createPersonType === 'collaborateur'
          ? `/api/collaborateurs?search=${encodeURIComponent(createPersonSearch)}&isActive=true`
          : `/api/remplacants?search=${encodeURIComponent(createPersonSearch)}&isActive=true`
        const res = await fetch(endpoint)
        const data = await res.json()
        setCreatePersonResults(
          (data.data || []).map((p: { id: number; firstName: string; lastName: string }) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
          }))
        )
      } catch (error) {
        console.error('Error searching persons:', error)
      } finally {
        setCreatePersonLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [isOpen, createStep, createPersonSearch, createPersonType])

  const handleSelectPerson = (person: { id: number; firstName: string; lastName: string }) => {
    setCreateSelectedPerson(person)
    setCreateStep(2)
  }

  const handleCreateAbsence = async () => {
    if (!createSelectedPerson || !createDateDebut || !createDateFin) return

    setCreateSaving(true)
    try {
      const endpoint = createPersonType === 'collaborateur'
        ? `/api/collaborateurs/${createSelectedPerson.id}/absences`
        : `/api/remplacants/${createSelectedPerson.id}/absences`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateDebut: createDateDebut,
          dateFin: createDateFin,
          creneau: createCreneau,
          motif: createMotif,
          motifDetails: createMotifDetails || undefined,
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        alert(error || 'Erreur lors de la création')
        return
      }

      const data = await res.json()
      onClose()
      onSuccess()
      if (data.data?.id) {
        router.push(`/absences/${data.data.id}`)
      }
    } catch (error) {
      console.error('Error creating absence:', error)
      alert('Erreur lors de la création de l\'absence')
    } finally {
      setCreateSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg overflow-visible">
        <div className="modal-header">
          <h3 className="text-lg font-semibold">
            {createStep === 1 ? 'Nouvelle absence — Sélection personne' : 'Nouvelle absence — Détails'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body overflow-visible">
          {createStep === 1 ? (
            <div className="space-y-4">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setCreatePersonType('collaborateur'); setCreatePersonSearch(''); setCreatePersonResults([]) }}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    createPersonType === 'collaborateur'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Collaborateur
                </button>
                <button
                  type="button"
                  onClick={() => { setCreatePersonType('remplacant'); setCreatePersonSearch(''); setCreatePersonResults([]) }}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    createPersonType === 'remplacant'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Remplaçant
                </button>
              </div>

              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Rechercher un ${createPersonType === 'collaborateur' ? 'collaborateur' : 'remplaçant'}...`}
                  value={createPersonSearch}
                  onChange={(e) => setCreatePersonSearch(e.target.value)}
                  className="form-input pl-9"
                  autoFocus
                />
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  {createPersonLoading ? (
                    <div className="flex items-center justify-center p-6">
                      <span className="inline-block w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
                      <span className="text-sm text-gray-500">Recherche...</span>
                    </div>
                  ) : !createPersonSearch.trim() ? (
                    <p className="text-sm text-gray-500 p-6 text-center">
                      Tapez un nom pour rechercher
                    </p>
                  ) : createPersonResults.length === 0 ? (
                    <p className="text-sm text-gray-500 p-6 text-center">
                      Aucun résultat
                    </p>
                  ) : (
                    createPersonResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPerson(p)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <span className="font-medium text-gray-900">{p.lastName.toUpperCase()}</span>{' '}
                        <span className="text-gray-600">{p.firstName}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-purple-800">
                    {createSelectedPerson?.lastName.toUpperCase()} {createSelectedPerson?.firstName}
                  </span>
                  <span className="text-xs text-purple-500 ml-2">
                    ({createPersonType === 'collaborateur' ? 'Collaborateur' : 'Remplaçant'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setCreateStep(1); setCreatePersonSearch(''); setCreatePersonResults([]) }}
                  className="text-purple-400 hover:text-purple-600"
                  title="Changer de personne"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Période *</label>
                <DateRangePicker
                  valueStart={createDateDebut}
                  valueEnd={createDateFin}
                  onChangeStart={setCreateDateDebut}
                  onChangeEnd={setCreateDateFin}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Créneau *</label>
                <select
                  value={createCreneau}
                  onChange={(e) => setCreateCreneau(e.target.value as 'matin' | 'apres_midi' | 'journee')}
                  className="form-select"
                  required
                >
                  <option value="journee">Journée</option>
                  <option value="matin">Matin</option>
                  <option value="apres_midi">Après-midi</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Motif *</label>
                <select
                  value={createMotif}
                  onChange={(e) => setCreateMotif(e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="maladie">Maladie</option>
                  <option value="conge">Congé</option>
                  <option value="formation">Formation</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Détails (optionnel)</label>
                <textarea
                  value={createMotifDetails}
                  onChange={(e) => setCreateMotifDetails(e.target.value)}
                  className="form-textarea"
                  rows={2}
                  placeholder="Précisions sur l'absence..."
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <div>
            {createStep === 2 && (
              <button
                type="button"
                onClick={() => { setCreateStep(1); setCreatePersonSearch(''); setCreatePersonResults([]) }}
                className="btn btn-secondary inline-flex items-center gap-1"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Retour
              </button>
            )}
          </div>
          <div className="modal-footer-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Annuler
            </button>
            {createStep === 2 && (
              <button
                type="button"
                onClick={handleCreateAbsence}
                disabled={createSaving || !createDateDebut || !createDateFin}
                className="btn btn-primary"
              >
                {createSaving ? 'Création...' : 'Créer l\'absence'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
