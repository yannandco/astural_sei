'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, UserGroupIcon, TrashIcon, PlusIcon, XMarkIcon, ChatBubbleLeftIcon, EyeIcon, PencilIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import {
  MonthCalendar,
  RecurringAvailabilityEditor,
  DisponibilitePeriode,
  DisponibiliteSpecifique,
  Affectation,
  VacancesScolaires,
  JourSemaine,
  Creneau,
  formatDate,
  getWeekDates,
  CRENEAU_LABELS,
} from '@/components/planning'
import { DatePicker } from '@/components/ui'

interface Remarque {
  id: number
  content: string
  createdAt: string
  createdByName: string | null
  createdByEmail: string | null
}

interface Observateur {
  id: number
  collaborateurId: number
  collaborateurLastName: string
  collaborateurFirstName: string
  collaborateurEmail: string | null
}

interface Collaborateur {
  id: number
  lastName: string
  firstName: string
}

type TabType = 'informations' | 'planning'

export default function RemplacantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('informations')
  const [remarques, setRemarques] = useState<Remarque[]>([])
  const [observateurs, setObservateurs] = useState<Observateur[]>([])
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([])

  const [showAddRemarque, setShowAddRemarque] = useState(false)
  const [newRemarque, setNewRemarque] = useState('')
  const [showAddObservateur, setShowAddObservateur] = useState(false)
  const [selectedCollaborateurId, setSelectedCollaborateurId] = useState('')
  const [observateurSearch, setObservateurSearch] = useState('')

  // Planning state
  const [periodes, setPeriodes] = useState<DisponibilitePeriode[]>([])
  const [specifiques, setSpecifiques] = useState<DisponibiliteSpecifique[]>([])
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [vacances, setVacances] = useState<VacancesScolaires[]>([])

  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    address: '',
    phone: '',
    email: '',
    contractStartDate: '',
    contractEndDate: '',
    obsTemporaire: '',
    isActive: true,
  })

  // Fetch planning data
  const fetchPlanningData = useCallback(async () => {
    try {
      // Calculate current week range
      const today = new Date()
      const weekDates = getWeekDates(today)
      const startDate = formatDate(weekDates[0])
      // Extend endDate to 3 months for affectations
      const endDate = new Date(today)
      endDate.setMonth(endDate.getMonth() + 3)
      const endDateStr = formatDate(endDate)

      const [periodesRes, specRes, affRes, vacRes] = await Promise.all([
        fetch(`/api/remplacants/${id}/disponibilites/periodes`),
        fetch(`/api/remplacants/${id}/disponibilites/specifiques?startDate=${startDate}&endDate=${endDateStr}`),
        fetch(`/api/remplacants/${id}/affectations?startDate=${startDate}&endDate=${endDateStr}`),
        fetch(`/api/vacances-scolaires?startDate=${startDate}&endDate=${endDateStr}`),
      ])

      if (periodesRes.ok) {
        const { data } = await periodesRes.json()
        setPeriodes(data)
      }
      if (specRes.ok) {
        const { data } = await specRes.json()
        setSpecifiques(data)
      }
      if (affRes.ok) {
        const { data } = await affRes.json()
        setAffectations(data)
      }
      if (vacRes.ok) {
        const { data } = await vacRes.json()
        setVacances(data)
      }
    } catch (error) {
      console.error('Error fetching planning data:', error)
    }
  }, [id])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [remplacantRes, remarquesRes, observateursRes, collaborateursRes] = await Promise.all([
          fetch(`/api/remplacants/${id}`),
          fetch(`/api/remplacants/${id}/remarques`),
          fetch(`/api/remplacants/${id}/observateurs`),
          fetch('/api/collaborateurs'),
        ])

        if (!remplacantRes.ok) {
          router.push('/remplacants')
          return
        }

        const remplacantData = await remplacantRes.json()
        const r = remplacantData.data
        setFormData({
          lastName: r.lastName,
          firstName: r.firstName,
          address: r.address || '',
          phone: r.phone || '',
          email: r.email || '',
          contractStartDate: r.contractStartDate || '',
          contractEndDate: r.contractEndDate || '',
          obsTemporaire: r.obsTemporaire || '',
          isActive: r.isActive,
        })

        const remarquesData = await remarquesRes.json()
        setRemarques(remarquesData.data || [])

        const observateursData = await observateursRes.json()
        setObservateurs(observateursData.data || [])

        const collaborateursData = await collaborateursRes.json()
        setCollaborateurs(collaborateursData.data || [])

        // Fetch planning data
        await fetchPlanningData()
      } catch (error) {
        console.error('Error fetching remplacant:', error)
        router.push('/remplacants')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, router, fetchPlanningData])

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/remplacants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) setIsEditMode(false)
    } catch (error) {
      console.error('Error saving remplacant:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce remplaçant ?')) return
    try {
      const res = await fetch(`/api/remplacants/${id}`, { method: 'DELETE' })
      if (res.ok) router.push('/remplacants')
    } catch (error) {
      console.error('Error deleting remplacant:', error)
    }
  }

  const handleAddRemarque = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRemarque.trim()) return
    try {
      const res = await fetch(`/api/remplacants/${id}/remarques`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newRemarque }),
      })
      if (res.ok) {
        const data = await res.json()
        setRemarques(prev => [data.data, ...prev])
        setNewRemarque('')
        setShowAddRemarque(false)
      }
    } catch (error) {
      console.error('Error adding remarque:', error)
    }
  }

  const handleAddObservateur = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCollaborateurId) return
    try {
      const res = await fetch(`/api/remplacants/${id}/observateurs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaborateurId: parseInt(selectedCollaborateurId) }),
      })
      if (res.ok) {
        const data = await res.json()
        setObservateurs(prev => [...prev, data.data])
        setSelectedCollaborateurId('')
        setShowAddObservateur(false)
      }
    } catch (error) {
      console.error('Error adding observateur:', error)
    }
  }

  const handleRemoveObservateur = async (observateurId: number) => {
    if (!confirm('Retirer cet observateur ?')) return
    try {
      const res = await fetch(`/api/remplacants/${id}/observateurs?observateurId=${observateurId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setObservateurs(prev => prev.filter(o => o.id !== observateurId))
      }
    } catch (error) {
      console.error('Error removing observateur:', error)
    }
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Handle periode creation
  const handleCreatePeriode = async (data: {
    nom: string
    dateDebut: string
    dateFin: string
    recurrences: { jourSemaine: JourSemaine; creneau: Creneau }[]
  }) => {
    console.log('[handleCreatePeriode] Création période:', data)
    const res = await fetch(`/api/remplacants/${id}/disponibilites/periodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const { error } = await res.json()
      console.error('[handleCreatePeriode] Erreur API:', error)
      throw new Error(error || 'Erreur lors de la création')
    }

    const result = await res.json()
    console.log('[handleCreatePeriode] Période créée:', result.data)
    await fetchPlanningData()
    console.log('[handleCreatePeriode] Planning rafraîchi')
  }

  // Handle periode update
  const handleUpdatePeriode = async (data: {
    id: number
    nom: string
    dateDebut: string
    dateFin: string
    recurrences: { jourSemaine: JourSemaine; creneau: Creneau }[]
  }) => {
    console.log('[handleUpdatePeriode] Modification période:', data)
    const res = await fetch(`/api/remplacants/${id}/disponibilites/periodes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodeId: data.id,
        nom: data.nom,
        dateDebut: data.dateDebut,
        dateFin: data.dateFin,
        recurrences: data.recurrences,
      }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      console.error('[handleUpdatePeriode] Erreur API:', error)
      throw new Error(error || 'Erreur lors de la modification')
    }

    const result = await res.json()
    console.log('[handleUpdatePeriode] Période modifiée:', result.data)
    await fetchPlanningData()
    console.log('[handleUpdatePeriode] Planning rafraîchi')
  }

  // Handle periode deletion
  const handleDeletePeriode = async (periodeId: number) => {
    const res = await fetch(`/api/remplacants/${id}/disponibilites/periodes?periodeId=${periodeId}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      const { error } = await res.json()
      throw new Error(error || 'Erreur lors de la suppression')
    }

    await fetchPlanningData()
  }

  // Filter out collaborateurs already observateurs
  const availableCollaborateurs = collaborateurs.filter(
    c => !observateurs.some(o => o.collaborateurId === c.id)
  )

  // Filter by search term
  const filteredCollaborateurs = availableCollaborateurs.filter(c => {
    if (!observateurSearch.trim()) return true
    const search = observateurSearch.toLowerCase()
    return c.lastName.toLowerCase().includes(search) || c.firstName.toLowerCase().includes(search)
  }).slice(0, 10) // Limit to 10 results

  if (loading) {
    return (
      <div className="ds-empty-state">
        <div className="ds-empty-state-content">
          <div className="spinner-md mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <UserGroupIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">{formData.firstName} {formData.lastName}</h1>
              <p className="ds-header-subtitle">Fiche remplaçant</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/remplacants" className="btn btn-secondary">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Retour
            </Link>
            {!isEditMode && (
              <button onClick={() => setIsEditMode(true)} className="btn btn-primary">
                <PencilIcon className="w-4 h-4 mr-2" />
                Modifier
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('informations')}
            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'informations'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Informations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('planning')}
            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'planning'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Planning
          </button>
        </nav>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Tab: Informations */}
        {activeTab === 'informations' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10">
            {/* Left column */}
            <div className="space-y-4">
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Informations</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">Nom {isEditMode && '*'}</label>
                        {isEditMode ? (
                          <input type="text" required value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-2 text-gray-900">{formData.lastName || '-'}</div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Prénom {isEditMode && '*'}</label>
                        {isEditMode ? (
                          <input type="text" required value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-2 text-gray-900">{formData.firstName || '-'}</div>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Adresse</label>
                      {isEditMode ? (
                        <input type="text" value={formData.address} onChange={(e) => updateField('address', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-2 text-gray-900">{formData.address || '-'}</div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">Téléphone</label>
                        {isEditMode ? (
                          <input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-2 text-gray-900">{formData.phone || '-'}</div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        {isEditMode ? (
                          <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-2 text-gray-900">{formData.email || '-'}</div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">Date début contrat</label>
                        {isEditMode ? (
                          <DatePicker value={formData.contractStartDate} onChange={(value) => updateField('contractStartDate', value)} />
                        ) : (
                          <div className="py-2 text-gray-900">{formData.contractStartDate ? new Date(formData.contractStartDate).toLocaleDateString('fr-FR') : '-'}</div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date fin contrat</label>
                        {isEditMode ? (
                          <DatePicker value={formData.contractEndDate} onChange={(value) => updateField('contractEndDate', value)} />
                        ) : (
                          <div className="py-2 text-gray-900">{formData.contractEndDate ? new Date(formData.contractEndDate).toLocaleDateString('fr-FR') : '-'}</div>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Observation temporaire</label>
                      {isEditMode ? (
                        <textarea value={formData.obsTemporaire} onChange={(e) => updateField('obsTemporaire', e.target.value)} className="form-input" rows={2} />
                      ) : (
                        <div className="py-2 text-gray-900 whitespace-pre-wrap">{formData.obsTemporaire || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Remarques section */}
              <div className="ds-table-container">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                      <ChatBubbleLeftIcon className="w-4 h-4" />
                      Remarques ({remarques.length})
                    </h2>
                    <button type="button" onClick={() => setShowAddRemarque(true)} className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1">
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  {remarques.length === 0 ? (
                    <p className="text-gray-500 text-sm">Aucune remarque.</p>
                  ) : (
                    <div className="space-y-3">
                      {remarques.map((remarque) => (
                        <div key={remarque.id} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{remarque.content}</p>
                          <div className="mt-2 text-xs text-gray-400">
                            {remarque.createdByName || remarque.createdByEmail || 'Utilisateur'} — {formatDateTime(remarque.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Observateurs section */}
              <div className="ds-table-container">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                      <EyeIcon className="w-4 h-4" />
                      Observateurs ({observateurs.length})
                    </h2>
                    <button type="button" onClick={() => setShowAddObservateur(true)} className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1">
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  {observateurs.length === 0 ? (
                    <p className="text-gray-500 text-sm">Aucun observateur.</p>
                  ) : (
                    <div className="space-y-2">
                      {observateurs.map((obs) => (
                        <div key={obs.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {obs.collaborateurFirstName} {obs.collaborateurLastName}
                            </span>
                            {obs.collaborateurEmail && (
                              <span className="text-xs text-gray-500 ml-2">{obs.collaborateurEmail}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveObservateur(obs.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Statut</h2>
                  <div className="form-group">
                    <label className="form-label">Actif</label>
                    {isEditMode ? (
                      <button
                        type="button"
                        onClick={() => updateField('isActive', !formData.isActive)}
                        className={formData.isActive ? 'status-badge-success' : 'status-badge-gray'}
                      >
                        {formData.isActive ? 'Actif' : 'Inactif'}
                      </button>
                    ) : (
                      <span className={formData.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                        {formData.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Planning */}
        {activeTab === 'planning' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
            {/* Left column - Calendar & Affectations */}
            <div className="space-y-4">
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                    <CalendarDaysIcon className="w-4 h-4" />
                    Calendrier
                  </h2>
                  <MonthCalendar
                    remplacantId={parseInt(id)}
                    periodes={periodes}
                    specifiques={specifiques}
                    affectations={affectations}
                    vacances={vacances}
                    onRefresh={fetchPlanningData}
                    readOnly={!isEditMode}
                  />
                </div>
              </div>

              {/* Affectations list */}
              {affectations.length > 0 && (
                <div className="ds-table-container">
                  <div className="p-5">
                    <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                      Affectations ({affectations.length})
                    </h2>
                    <div className="space-y-2">
                      {affectations.slice(0, 10).map((aff) => (
                        <div key={aff.id} className="bg-purple-50 rounded-lg px-3 py-2 text-sm">
                          <div className="font-medium text-purple-800">
                            {new Date(aff.dateDebut).toLocaleDateString('fr-FR')}
                            {aff.dateDebut !== aff.dateFin && ` - ${new Date(aff.dateFin).toLocaleDateString('fr-FR')}`}
                            {' • '}{CRENEAU_LABELS[aff.creneau]}
                          </div>
                          <div className="text-purple-600">
                            Remplace {aff.collaborateurPrenom} {aff.collaborateurNom} ({aff.ecoleNom})
                          </div>
                        </div>
                      ))}
                      {affectations.length > 10 && (
                        <p className="text-xs text-gray-500">... et {affectations.length - 10} autres</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right column - Periods */}
            <div className="space-y-4">
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                    Périodes de disponibilité
                  </h2>
                  <RecurringAvailabilityEditor
                    remplacantId={parseInt(id)}
                    periodes={periodes}
                    onCreatePeriode={handleCreatePeriode}
                    onUpdatePeriode={handleUpdatePeriode}
                    onDeletePeriode={handleDeletePeriode}
                    readOnly={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions - only in edit mode */}
        {isEditMode && (
          <div className="flex justify-between items-center mt-4">
            <button type="button" onClick={handleDelete} className="text-gray-400 hover:text-red-600 p-2 transition-colors" title="Supprimer">
              <TrashIcon className="w-5 h-5" />
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsEditMode(false)} className="btn btn-secondary">Annuler</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Add Remarque Modal */}
      {showAddRemarque && (
        <div className="modal-overlay">
          <div className="modal-container max-w-lg">
            <div className="modal-header">
              <div className="modal-header-content">
                <h3 className="modal-title">Nouvelle remarque</h3>
                <button onClick={() => setShowAddRemarque(false)} className="modal-close-button"><XMarkIcon className="h-5 w-5" /></button>
              </div>
            </div>
            <form onSubmit={handleAddRemarque}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Remarque *</label>
                  <textarea
                    required
                    value={newRemarque}
                    onChange={(e) => setNewRemarque(e.target.value)}
                    className="form-input"
                    rows={4}
                    placeholder="Saisissez votre remarque..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <div></div>
                <div className="modal-footer-actions">
                  <button type="button" onClick={() => setShowAddRemarque(false)} className="btn btn-secondary">Annuler</button>
                  <button type="submit" className="btn btn-primary">Ajouter</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Observateur Modal */}
      {showAddObservateur && (
        <div className="modal-overlay">
          <div className="modal-container max-w-lg">
            <div className="modal-header">
              <div className="modal-header-content">
                <h3 className="modal-title">Ajouter un observateur</h3>
                <button onClick={() => { setShowAddObservateur(false); setObservateurSearch(''); setSelectedCollaborateurId(''); }} className="modal-close-button"><XMarkIcon className="h-5 w-5" /></button>
              </div>
            </div>
            <form onSubmit={handleAddObservateur}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Rechercher un collaborateur *</label>
                  <input
                    type="text"
                    value={observateurSearch}
                    onChange={(e) => { setObservateurSearch(e.target.value); setSelectedCollaborateurId(''); }}
                    className="form-input"
                    placeholder="Nom ou prénom..."
                    autoFocus
                  />
                </div>
                {selectedCollaborateurId && (
                  <div className="mt-2 p-2 bg-purple-50 rounded-md flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-700">
                      {availableCollaborateurs.find(c => c.id === parseInt(selectedCollaborateurId))?.firstName} {availableCollaborateurs.find(c => c.id === parseInt(selectedCollaborateurId))?.lastName}
                    </span>
                    <button type="button" onClick={() => setSelectedCollaborateurId('')} className="text-purple-500 hover:text-purple-700">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!selectedCollaborateurId && observateurSearch.trim() && filteredCollaborateurs.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                    {filteredCollaborateurs.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedCollaborateurId(String(c.id)); setObservateurSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0"
                      >
                        <span className="font-medium">{c.firstName} {c.lastName}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!selectedCollaborateurId && observateurSearch.trim() && filteredCollaborateurs.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">Aucun collaborateur trouvé.</p>
                )}
                {availableCollaborateurs.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">Tous les collaborateurs sont déjà observateurs.</p>
                )}
              </div>
              <div className="modal-footer">
                <div></div>
                <div className="modal-footer-actions">
                  <button type="button" onClick={() => { setShowAddObservateur(false); setObservateurSearch(''); setSelectedCollaborateurId(''); }} className="btn btn-secondary">Annuler</button>
                  <button type="submit" disabled={!selectedCollaborateurId} className="btn btn-primary">Ajouter</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
