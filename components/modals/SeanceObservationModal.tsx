'use client'

import { useState, useEffect, useMemo } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'

interface Collaborateur {
  id: number
  lastName: string
  firstName: string
}

interface RemplacantOption {
  id: number
  lastName: string
  firstName: string
}

interface EcoleOption {
  id: number
  name: string
}

interface SeanceObservationModalProps {
  isOpen: boolean
  onClose: () => void
  remplacantId: string
  collaborateurs: Collaborateur[]
  remplacantsList: RemplacantOption[]
  ecolesList: EcoleOption[]
  onSuccess: (data: { data: unknown }) => void
}

export default function SeanceObservationModal({
  isOpen,
  onClose,
  remplacantId,
  collaborateurs,
  remplacantsList,
  ecolesList,
  onSuccess,
}: SeanceObservationModalProps) {
  const [seanceDate, setSeanceDate] = useState('')
  const [seanceCreneau, setSeanceCreneau] = useState('matin')
  const [seanceEcoleId, setSeanceEcoleId] = useState('')
  const [seanceEcoleSearch, setSeanceEcoleSearch] = useState('')
  const [seanceObservateurType, setSeanceObservateurType] = useState<'collaborateur' | 'remplacant'>('collaborateur')
  const [seanceObservateurId, setSeanceObservateurId] = useState('')
  const [seanceObservateurSearch, setSeanceObservateurSearch] = useState('')
  const [seanceNote, setSeanceNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSeanceDate('')
      setSeanceCreneau('matin')
      setSeanceEcoleId('')
      setSeanceEcoleSearch('')
      setSeanceObservateurType('collaborateur')
      setSeanceObservateurId('')
      setSeanceObservateurSearch('')
      setSeanceNote('')
    }
  }, [isOpen])

  const filteredEcoles = useMemo(() => {
    return ecolesList.filter(e => {
      if (!seanceEcoleSearch.trim()) return true
      return e.name.toLowerCase().includes(seanceEcoleSearch.toLowerCase())
    }).slice(0, 10)
  }, [ecolesList, seanceEcoleSearch])

  const observateurOptions = seanceObservateurType === 'collaborateur' ? collaborateurs : remplacantsList
  const filteredObservateurs = useMemo(() => {
    return observateurOptions.filter(p => {
      if (!seanceObservateurSearch.trim()) return true
      const search = seanceObservateurSearch.toLowerCase()
      return p.lastName.toLowerCase().includes(search) || p.firstName.toLowerCase().includes(search)
    }).slice(0, 10)
  }, [observateurOptions, seanceObservateurSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!seanceDate || !seanceCreneau || !seanceEcoleId || !seanceObservateurId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/remplacants/${remplacantId}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: seanceDate,
          creneau: seanceCreneau,
          ecoleId: parseInt(seanceEcoleId),
          observateurType: seanceObservateurType,
          observateurId: parseInt(seanceObservateurId),
          note: seanceNote,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Erreur lors de l\'ajout')
        return
      }
      const data = await res.json()
      onSuccess(data)
      onClose()
    } catch (error) {
      console.error('Error adding seance:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg">
        <div className="modal-header">
          <h3 className="text-lg font-semibold">Ajouter une séance d&apos;observation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <DatePicker value={seanceDate} onChange={setSeanceDate} />
            </div>

            <div className="form-group">
              <label className="form-label">Créneau *</label>
              <select value={seanceCreneau} onChange={(e) => setSeanceCreneau(e.target.value)} className="form-input">
                <option value="matin">Matin</option>
                <option value="apres_midi">Après-midi</option>
                <option value="journee">Journée</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">École *</label>
              {seanceEcoleId ? (
                <div className="p-2 bg-purple-50 rounded-md flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-700">
                    {ecolesList.find(e => e.id === parseInt(seanceEcoleId))?.name}
                  </span>
                  <button type="button" onClick={() => setSeanceEcoleId('')} className="text-purple-500 hover:text-purple-700">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={seanceEcoleSearch}
                    onChange={(e) => setSeanceEcoleSearch(e.target.value)}
                    className="form-input"
                    placeholder="Rechercher une école..."
                  />
                  {seanceEcoleSearch.trim() && filteredEcoles.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                      {filteredEcoles.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => { setSeanceEcoleId(String(e.id)); setSeanceEcoleSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0"
                        >
                          {e.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Type d&apos;observateur *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setSeanceObservateurType('collaborateur'); setSeanceObservateurId(''); setSeanceObservateurSearch(''); }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    seanceObservateurType === 'collaborateur'
                      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Collaborateur
                </button>
                <button
                  type="button"
                  onClick={() => { setSeanceObservateurType('remplacant'); setSeanceObservateurId(''); setSeanceObservateurSearch(''); }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    seanceObservateurType === 'remplacant'
                      ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Remplaçant
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observateur *</label>
              {seanceObservateurId ? (
                <div className="p-2 bg-purple-50 rounded-md flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-700">
                    {observateurOptions.find(p => p.id === parseInt(seanceObservateurId))?.firstName} {observateurOptions.find(p => p.id === parseInt(seanceObservateurId))?.lastName}
                  </span>
                  <button type="button" onClick={() => setSeanceObservateurId('')} className="text-purple-500 hover:text-purple-700">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={seanceObservateurSearch}
                    onChange={(e) => { setSeanceObservateurSearch(e.target.value); setSeanceObservateurId(''); }}
                    className="form-input"
                    placeholder="Nom ou prénom..."
                  />
                  {seanceObservateurSearch.trim() && filteredObservateurs.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                      {filteredObservateurs.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setSeanceObservateurId(String(p.id)); setSeanceObservateurSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0"
                        >
                          <span className="font-medium">{p.firstName} {p.lastName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {seanceObservateurSearch.trim() && filteredObservateurs.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">Aucun résultat.</p>
                  )}
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea
                value={seanceNote}
                onChange={(e) => setSeanceNote(e.target.value)}
                className="form-input"
                rows={2}
                placeholder="Note optionnelle..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <div></div>
            <div className="modal-footer-actions">
              <button type="button" onClick={onClose} className="btn btn-secondary">Annuler</button>
              <button type="submit" disabled={saving || !seanceDate || !seanceEcoleId || !seanceObservateurId} className="btn btn-primary">{saving ? 'Ajout...' : 'Ajouter'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
