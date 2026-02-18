'use client'

import { useState, useEffect, useMemo } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'
import { Creneau, CRENEAU_LABELS, Affectation, getJourSemaine } from './types'

interface Collaborateur {
  id: number
  lastName: string
  firstName: string
}

interface Ecole {
  id: number
  name: string
}

interface CollabPresence {
  ecoleId: number
  ecoleName: string
  joursPresence: { jour: string; creneau: Creneau }[]
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
  const [collabPresences, setCollabPresences] = useState<CollabPresence[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [collaborateurId, setCollaborateurId] = useState<number | ''>('')
  const [ecoleId, setEcoleId] = useState<number | ''>('')
  const [dateDebut, setDateDebut] = useState(initialDate || '')
  const [dateFin, setDateFin] = useState(initialDate || '')
  const [creneau, setCreneau] = useState<Creneau>(initialCreneau || 'matin')
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
        setCreneau(initialCreneau || 'matin')
        setMotif('')
        setCollabPresences([])
      }
    }
  }, [isOpen, editingAffectation, initialDate, initialCreneau])

  // Fetch collaborateur presences when collaborateur changes
  useEffect(() => {
    if (!collaborateurId || editingAffectation) return
    setCollabPresences([])
    setEcoleId('')
    setCreneau('matin')
    const fetchPresences = async () => {
      try {
        const res = await fetch(`/api/collaborateurs/${collaborateurId}/planning`)
        if (res.ok) {
          const { data } = await res.json()
          const presences: CollabPresence[] = (data.presences || []).map((p: { ecoleId: number; ecoleName: string; joursPresence: { jour: string; creneau: Creneau }[] }) => ({
            ecoleId: p.ecoleId,
            ecoleName: p.ecoleName,
            joursPresence: p.joursPresence || [],
          }))
          setCollabPresences(presences)

          // Auto-select école if collaborateur has only one
          const collabEcoleIds = [...new Set(presences.map(p => p.ecoleId))]
          if (collabEcoleIds.length === 1) {
            setEcoleId(collabEcoleIds[0])
          }
        }
      } catch (error) {
        console.error('Error fetching collaborateur presences:', error)
      }
    }
    fetchPresences()
  }, [collaborateurId, editingAffectation])

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

  // Ecole IDs du collaborateur sélectionné
  const collabEcoleIds = new Set(collabPresences.map(p => p.ecoleId))

  // Jours de la semaine couverts par la plage de dates sélectionnée
  const selectedJours = useMemo(() => {
    if (!dateDebut || !dateFin) return null
    const jours = new Set<string>()
    const start = new Date(dateDebut + 'T00:00:00')
    const end = new Date(dateFin + 'T00:00:00')
    const current = new Date(start)
    // Limiter à 31 jours max pour éviter boucle infinie
    let count = 0
    while (current <= end && count < 31) {
      const jour = getJourSemaine(current)
      if (jour) jours.add(jour)
      current.setDate(current.getDate() + 1)
      count++
    }
    return jours
  }, [dateDebut, dateFin])

  // Créneaux du collaborateur filtrés par les jours sélectionnés
  const collabCreneaux = useMemo(() => {
    if (collabPresences.length === 0) return new Set<Creneau>()
    const presencesToUse = ecoleId
      ? collabPresences.filter(p => p.ecoleId === ecoleId)
      : collabPresences
    const filtered = presencesToUse.flatMap(p =>
      p.joursPresence
        .filter(jp => !selectedJours || selectedJours.has(jp.jour))
        .map(jp => jp.creneau)
    )
    return new Set(filtered)
  }, [collabPresences, selectedJours, ecoleId])

  // Auto-select créneau when collabCreneaux changes (reacts to dates/école/presences)
  useEffect(() => {
    if (editingAffectation || collabCreneaux.size === 0) return
    const creneauxArr = [...collabCreneaux] as Creneau[]
    if (!collabCreneaux.has(creneau)) {
      setCreneau(creneauxArr[0])
    }
  }, [collabCreneaux]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Sort écoles: collaborateur's schools first
  const filteredEcoles = ecoles
    .filter((e) => e.name.toLowerCase().includes(searchEcole.toLowerCase()))
    .sort((a, b) => {
      const aIsCollab = collabEcoleIds.has(a.id) ? 0 : 1
      const bIsCollab = collabEcoleIds.has(b.id) ? 0 : 1
      if (aIsCollab !== bIsCollab) return aIsCollab - bIsCollab
      return a.name.localeCompare(b.name)
    })

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg overflow-visible">
        <div className="modal-header">
          <h3 className="modal-title">
            {editingAffectation ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
          </h3>
          <button onClick={onClose} className="modal-close-button">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4 overflow-visible">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : (
              <>
                {/* Collaborateur */}
                <div className="form-group">
                  <label className="form-label">Collaborateur remplacé *</label>
                  {collaborateurId ? (
                    <div className="p-2 bg-purple-50 rounded-md flex items-center justify-between">
                      <span className="text-sm font-medium text-purple-700">
                        {collaborateurs.find(c => c.id === collaborateurId)?.firstName} {collaborateurs.find(c => c.id === collaborateurId)?.lastName}
                      </span>
                      <button type="button" onClick={() => { setCollaborateurId(''); setSearchCollab(''); setCollabPresences([]); setEcoleId(''); setSearchEcole(''); }} className="text-purple-500 hover:text-purple-700">
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
                      {searchCollab.trim() && filteredCollaborateurs.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                          {filteredCollaborateurs.slice(0, 10).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setCollaborateurId(c.id); setSearchCollab(''); }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0"
                            >
                              <span className="font-medium">{c.firstName} {c.lastName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchCollab.trim() && filteredCollaborateurs.length === 0 && (
                        <p className="text-sm text-gray-500 mt-1">Aucun résultat.</p>
                      )}
                    </>
                  )}
                </div>

                {/* École */}
                <div className="form-group">
                  <label className="form-label">École *</label>
                  {ecoleId ? (
                    <div className="p-2 bg-purple-50 rounded-md flex items-center justify-between">
                      <span className="text-sm font-medium text-purple-700">
                        {ecoles.find(e => e.id === ecoleId)?.name}
                        {collabEcoleIds.has(ecoleId as number) && (
                          <span className="ml-2 text-xs text-purple-500">(école du collaborateur)</span>
                        )}
                      </span>
                      <button type="button" onClick={() => { setEcoleId(''); setSearchEcole(''); }} className="text-purple-500 hover:text-purple-700">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Rechercher une école..."
                        value={searchEcole}
                        onChange={(e) => setSearchEcole(e.target.value)}
                        className="form-input"
                      />
                      {/* Show collaborateur's schools even without search */}
                      {collabEcoleIds.size > 0 && !searchEcole.trim() && (
                        <div className="mt-1 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">Écoles du collaborateur</div>
                          {filteredEcoles.filter(e => collabEcoleIds.has(e.id)).map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => { setEcoleId(e.id); setSearchEcole(''); }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0"
                            >
                              <span className="font-medium">{e.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchEcole.trim() && filteredEcoles.length > 0 && (
                        <div className="mt-1 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                          {collabEcoleIds.size > 0 && filteredEcoles.some(e => collabEcoleIds.has(e.id)) && (
                            <>
                              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">Écoles du collaborateur</div>
                              {filteredEcoles.filter(e => collabEcoleIds.has(e.id)).map((e) => (
                                <button
                                  key={e.id}
                                  type="button"
                                  onClick={() => { setEcoleId(e.id); setSearchEcole(''); }}
                                  className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b border-gray-100"
                                >
                                  <span className="font-medium text-purple-700">{e.name}</span>
                                </button>
                              ))}
                            </>
                          )}
                          {filteredEcoles.filter(e => !collabEcoleIds.has(e.id)).length > 0 && (
                            <>
                              {collabEcoleIds.size > 0 && (
                                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">Autres écoles</div>
                              )}
                              {filteredEcoles.filter(e => !collabEcoleIds.has(e.id)).slice(0, 10).map((e) => (
                                <button
                                  key={e.id}
                                  type="button"
                                  onClick={() => { setEcoleId(e.id); setSearchEcole(''); }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0"
                                >
                                  {e.name}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                      {searchEcole.trim() && filteredEcoles.length === 0 && (
                        <p className="text-sm text-gray-500 mt-1">Aucun résultat.</p>
                      )}
                    </>
                  )}
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
                  {collaborateurId && collabPresences.length > 0 && dateDebut && collabCreneaux.size === 0 ? (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                      <p className="text-sm text-orange-700 font-medium">
                        {collaborateurs.find(c => c.id === collaborateurId)?.firstName} {collaborateurs.find(c => c.id === collaborateurId)?.lastName} ne travaille pas sur cette période
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Vous pouvez quand même forcer un créneau :
                      </p>
                      <select
                        value={creneau}
                        onChange={(e) => setCreneau(e.target.value as Creneau)}
                        className="form-select mt-2"
                        required
                      >
                        {Object.entries(CRENEAU_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <select
                      value={creneau}
                      onChange={(e) => setCreneau(e.target.value as Creneau)}
                      className="form-select"
                      required
                    >
                      {collabCreneaux.size > 0 ? (
                        <>
                          <optgroup label="Créneaux du collaborateur">
                            {Object.entries(CRENEAU_LABELS)
                              .filter(([value]) => collabCreneaux.has(value as Creneau))
                              .map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                          </optgroup>
                          <optgroup label="Autres">
                            {Object.entries(CRENEAU_LABELS)
                              .filter(([value]) => !collabCreneaux.has(value as Creneau))
                              .map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                          </optgroup>
                        </>
                      ) : (
                        Object.entries(CRENEAU_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))
                      )}
                    </select>
                  )}
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
