'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, UserIcon, TrashIcon, PencilIcon, CalendarDaysIcon, BuildingOfficeIcon, PlusIcon, XMarkIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import {
  CollaborateurMonthCalendar,
  AbsenceModal,
  ReplacementModal,
  AbsenceData,
  MOTIF_LABELS,
  Creneau,
  CRENEAU_LABELS,
  JOUR_LABELS,
  JOURS_SEMAINE,
  CRENEAUX,
  JourSemaine,
  getWeekDates,
  formatDate,
} from '@/components/planning'
import type { CellClickInfo } from '@/components/planning/CollaborateurMonthCalendar'
import { DatePicker } from '@/components/ui'

interface JourPresence {
  jour: JourSemaine
  creneau: Creneau
}

interface Presence {
  ecoleId: number
  ecoleName: string
  joursPresence: JourPresence[]
  dateDebut: string | null
  dateFin: string | null
}

interface Affectation {
  id: number
  ecoleId: number
  ecoleName: string | null
  etablissementName: string | null
  periodeId: number | null
  periodeCode: string | null
  periodeLabel: string | null
  joursPresence: string | null
  isActive: boolean
}

interface Ecole {
  id: number
  name: string
  etablissementName: string | null
}

interface PeriodeScolaire {
  id: number
  code: string
  label: string
}

interface Remplacement {
  id: number
  remplacantId: number
  remplacantNom: string | null
  remplacantPrenom: string | null
  ecoleId: number
  ecoleNom: string | null
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string | null
}

interface Remarque {
  id: number
  content: string
  createdAt: string
  createdByName: string | null
  createdByEmail: string | null
}

interface Sector {
  id: number
  name: string
}

interface Collaborateur {
  id: number
  lastName: string
  firstName: string
  address: string | null
  postalCode: string | null
  city: string | null
  mobilePro: string | null
  email: string | null
  secteurId: number | null
  taux: string | null
  contratType: 'CDI' | 'CDD' | 'Mixte' | null
  contratDetails: string | null
  canton: string | null
  pays: string | null
  sexe: 'M' | 'F' | null
  dateSortie: string | null
  isActive: boolean
  secteurName: string | null
}

type TabType = 'informations' | 'planning'

export default function CollaborateurDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('informations')
  const [sectors, setSectors] = useState<Sector[]>([])
  const [remplacements, setRemplacements] = useState<Remplacement[]>([])
  const [presences, setPresences] = useState<Presence[]>([])
  const [absencesCollab, setAbsencesCollab] = useState<AbsenceData[]>([])
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<AbsenceData | null>(null)
  const [showReplacementModal, setShowReplacementModal] = useState(false)
  const [editingRemplacement, setEditingRemplacement] = useState<Remplacement | null>(null)
  const [cellActionMenu, setCellActionMenu] = useState<CellClickInfo | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillCreneau, setPrefillCreneau] = useState<Creneau | null>(null)

  // Remarques
  const [remarques, setRemarques] = useState<Remarque[]>([])
  const [showAddRemarque, setShowAddRemarque] = useState(false)
  const [newRemarque, setNewRemarque] = useState('')

  // Affectations management
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [ecoles, setEcoles] = useState<Ecole[]>([])
  const [periodes, setPeriodes] = useState<PeriodeScolaire[]>([])
  const [showAffectationModal, setShowAffectationModal] = useState(false)
  const [editingAffectation, setEditingAffectation] = useState<Affectation | null>(null)
  const [affectationForm, setAffectationForm] = useState({
    ecoleId: '',
    periodeId: '',
    joursPresence: [] as JourPresence[],
  })

  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    address: '',
    postalCode: '',
    city: '',
    mobilePro: '',
    email: '',
    secteurId: '',
    taux: '',
    contratType: '',
    contratDetails: '',
    canton: '',
    pays: '',
    sexe: '',
    dateSortie: '',
    isActive: true,
  })

  // Fetch planning data for a 3-month range
  const fetchPlanningData = useCallback(async () => {
    try {
      const today = new Date()
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0)
      const startDateStr = formatDate(startDate)
      const endDateStr = formatDate(endDate)

      const [planRes, absRes] = await Promise.all([
        fetch(`/api/collaborateurs/${id}/planning?startDate=${startDateStr}&endDate=${endDateStr}`),
        fetch(`/api/collaborateurs/${id}/absences?startDate=${startDateStr}&endDate=${endDateStr}`),
      ])
      if (planRes.ok) {
        const { data } = await planRes.json()
        setPresences(data?.presences || [])
        setRemplacements(data?.remplacements || [])
      }
      if (absRes.ok) {
        const { data } = await absRes.json()
        setAbsencesCollab(data || [])
      }
    } catch (error) {
      console.error('Error fetching planning:', error)
    }
  }, [id])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [collabRes, sectorsRes, ecolesRes, periodesRes, affectationsRes, remarquesRes] = await Promise.all([
          fetch(`/api/collaborateurs/${id}`),
          fetch('/api/sectors'),
          fetch('/api/ecoles'),
          fetch('/api/periodes-scolaires'),
          fetch(`/api/collaborateurs/${id}/ecoles`),
          fetch(`/api/collaborateurs/${id}/remarques`),
        ])

        if (!collabRes.ok) {
          router.push('/collaborateurs')
          return
        }

        const collabData = await collabRes.json()
        const sectorsData = await sectorsRes.json()
        const ecolesData = await ecolesRes.json()
        const periodesData = await periodesRes.json()
        const affectationsData = await affectationsRes.json()
        const remarquesData = await remarquesRes.json()
        const c: Collaborateur = collabData.data

        setSectors(sectorsData.data || [])
        setEcoles((ecolesData.data || []).map((e: { id: number; name: string; etablissementName?: string }) => ({
          id: e.id,
          name: e.name,
          etablissementName: e.etablissementName || null,
        })))
        setPeriodes(periodesData.data || [])
        setAffectations(affectationsData.data || [])
        setRemarques(remarquesData.data || [])
        setFormData({
          lastName: c.lastName,
          firstName: c.firstName,
          address: c.address || '',
          postalCode: c.postalCode || '',
          city: c.city || '',
          mobilePro: c.mobilePro || '',
          email: c.email || '',
          secteurId: c.secteurId?.toString() || '',
          taux: c.taux || '',
          contratType: c.contratType || '',
          contratDetails: c.contratDetails || '',
          canton: c.canton || '',
          pays: c.pays || '',
          sexe: c.sexe || '',
          dateSortie: c.dateSortie || '',
          isActive: c.isActive,
        })

        // Fetch planning data
        await fetchPlanningData()
      } catch (error) {
        console.error('Error fetching collaborateur:', error)
        router.push('/collaborateurs')
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

    const payload = {
      ...formData,
      secteurId: formData.secteurId ? parseInt(formData.secteurId) : null,
      taux: formData.taux || null,
      contratType: formData.contratType || null,
      sexe: formData.sexe || null,
      dateSortie: formData.dateSortie || null,
    }

    try {
      const res = await fetch(`/api/collaborateurs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setIsEditMode(false)
      }
    } catch (error) {
      console.error('Error saving collaborateur:', error)
    } finally {
      setSaving(false)
    }
  }

  const getSectorName = (secteurId: string) => {
    if (!secteurId) return '-'
    const sector = sectors.find(s => s.id.toString() === secteurId)
    return sector?.name || '-'
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce collaborateur ?')) return
    try {
      const res = await fetch(`/api/collaborateurs/${id}`, { method: 'DELETE' })
      if (res.ok) router.push('/collaborateurs')
    } catch (error) {
      console.error('Error deleting collaborateur:', error)
    }
  }

  // ─── Affectation handlers ───────────────────────────────────

  const refreshAffectations = async () => {
    try {
      const res = await fetch(`/api/collaborateurs/${id}/ecoles`)
      if (res.ok) {
        const data = await res.json()
        setAffectations(data.data || [])
      }
      // Also refresh planning data
      await fetchPlanningData()
    } catch (error) {
      console.error('Error refreshing affectations:', error)
    }
  }

  const openAddAffectation = () => {
    setEditingAffectation(null)
    setAffectationForm({
      ecoleId: '',
      periodeId: periodes.find(p => p.code === 'R25')?.id.toString() || '',
      joursPresence: [],
    })
    setShowAffectationModal(true)
  }

  const openEditAffectation = (aff: Affectation) => {
    setEditingAffectation(aff)
    let jours: JourPresence[] = []
    if (aff.joursPresence) {
      try {
        jours = JSON.parse(aff.joursPresence)
      } catch {
        jours = []
      }
    }
    setAffectationForm({
      ecoleId: aff.ecoleId.toString(),
      periodeId: aff.periodeId?.toString() || '',
      joursPresence: jours,
    })
    setShowAffectationModal(true)
  }

  const toggleJourPresence = (jour: JourSemaine, creneau: Creneau) => {
    setAffectationForm(prev => {
      const exists = prev.joursPresence.some(jp => jp.jour === jour && jp.creneau === creneau)
      if (exists) {
        return {
          ...prev,
          joursPresence: prev.joursPresence.filter(jp => !(jp.jour === jour && jp.creneau === creneau)),
        }
      } else {
        return {
          ...prev,
          joursPresence: [...prev.joursPresence, { jour, creneau }],
        }
      }
    })
  }

  const isJourSelected = (jour: JourSemaine, creneau: Creneau) => {
    return affectationForm.joursPresence.some(jp => jp.jour === jour && jp.creneau === creneau)
  }

  const handleSaveAffectation = async () => {
    if (!affectationForm.ecoleId) {
      alert('Veuillez sélectionner une école')
      return
    }

    const payload = {
      ecoleId: parseInt(affectationForm.ecoleId),
      periodeId: affectationForm.periodeId ? parseInt(affectationForm.periodeId) : null,
      joursPresence: affectationForm.joursPresence,
    }

    try {
      if (editingAffectation) {
        // Update
        const res = await fetch(`/api/collaborateurs/${id}/ecoles/${editingAffectation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const error = await res.json()
          alert(error.error || 'Erreur lors de la mise à jour')
          return
        }
      } else {
        // Create
        const res = await fetch(`/api/collaborateurs/${id}/ecoles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const error = await res.json()
          alert(error.error || 'Erreur lors de la création')
          return
        }
      }

      setShowAffectationModal(false)
      refreshAffectations()
    } catch (error) {
      console.error('Error saving affectation:', error)
      alert('Erreur lors de la sauvegarde')
    }
  }

  const handleDeleteAffectation = async (affId: number) => {
    if (!confirm('Supprimer cette affectation ?')) return

    try {
      const res = await fetch(`/api/collaborateurs/${id}/ecoles/${affId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        refreshAffectations()
      } else {
        const error = await res.json()
        alert(error.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error deleting affectation:', error)
      alert('Erreur lors de la suppression')
    }
  }

  // ─── Remarque handlers ─────────────────────────────────────

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleAddRemarque = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRemarque.trim()) return
    try {
      const res = await fetch(`/api/collaborateurs/${id}/remarques`, {
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

  // ─── Absence handlers ─────────────────────────────────────
  const handleSaveAbsence = async (data: {
    dateDebut: string
    dateFin: string
    creneau: Creneau
    motif: string
    motifDetails?: string
  }) => {
    if (editingAbsence) {
      const res = await fetch(`/api/collaborateurs/${id}/absences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absenceId: editingAbsence.id, ...data }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        alert(error || 'Erreur lors de la modification')
        return
      }
    } else {
      const res = await fetch(`/api/collaborateurs/${id}/absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const { error } = await res.json()
        alert(error || 'Erreur lors de la création')
        return
      }
    }
    setEditingAbsence(null)
    await fetchPlanningData()
  }

  const handleDeleteAbsence = async (absenceId: number) => {
    if (!confirm('Supprimer cette absence ?')) return
    try {
      const res = await fetch(`/api/collaborateurs/${id}/absences?absenceId=${absenceId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchPlanningData()
      }
    } catch (error) {
      console.error('Error deleting absence:', error)
    }
  }

  // ─── Remplacement handlers ─────────────────────────────────
  const handleSaveReplacement = async (data: {
    remplacantId: number
    dateDebut: string
    dateFin: string
    entries: { ecoleId: number; date: string; creneau: Creneau }[]
    motif: string
    motifDetails?: string
  }) => {
    const res = await fetch(`/api/collaborateurs/${id}/remplacements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const { error } = await res.json()
      alert(error || 'Erreur lors de la création du remplacement')
      throw new Error(error)
    }
    await fetchPlanningData()
  }

  const handleUpdateReplacement = async (data: { affectationId: number; remplacantId: number }) => {
    const res = await fetch(`/api/collaborateurs/${id}/remplacements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const { error } = await res.json()
      alert(error || 'Erreur lors de la mise à jour')
      throw new Error(error)
    }
    setEditingRemplacement(null)
    await fetchPlanningData()
  }

  const handleDeleteRemplacement = async (affectationId: number) => {
    if (!confirm('Supprimer ce remplacement ? L\'absence associée sera conservée.')) return
    try {
      const res = await fetch(`/api/collaborateurs/${id}/remplacements?affectationId=${affectationId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchPlanningData()
      }
    } catch (error) {
      console.error('Error deleting remplacement:', error)
    }
  }

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
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <UserIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">{formData.firstName} {formData.lastName}</h1>
              <p className="ds-header-subtitle">Fiche collaborateur</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/collaborateurs" className="btn btn-secondary">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Retour
            </Link>
            {!isEditMode && (
              <>
                <button
                  onClick={() => { setEditingAbsence(null); setShowAbsenceModal(true) }}
                  className="btn btn-secondary"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Déclarer une absence
                </button>
                <button
                  onClick={() => { setEditingRemplacement(null); setShowReplacementModal(true) }}
                  className="btn btn-secondary"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Annoncer un remplacement
                </button>
                <button onClick={() => setIsEditMode(true)} className="btn btn-primary">
                  <PencilIcon className="w-4 h-4 mr-2" />
                  Modifier
                </button>
              </>
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

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* Tab: Informations */}
        {activeTab === 'informations' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10">
            {/* Colonne gauche */}
            <div className="space-y-4">
              {/* Identité */}
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Identité</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="form-group">
                      <label className="form-label">Nom {isEditMode && '*'}</label>
                      {isEditMode ? (
                        <input type="text" required value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.lastName || '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prénom {isEditMode && '*'}</label>
                      {isEditMode ? (
                        <input type="text" required value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.firstName || '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sexe</label>
                      {isEditMode ? (
                        <select value={formData.sexe} onChange={(e) => updateField('sexe', e.target.value)} className="form-input">
                          <option value="">-- Non renseigné --</option>
                          <option value="M">Masculin</option>
                          <option value="F">Féminin</option>
                        </select>
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.sexe === 'M' ? 'Masculin' : formData.sexe === 'F' ? 'Féminin' : '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Contact</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      {isEditMode ? (
                        <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.email || '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile professionnel</label>
                      {isEditMode ? (
                        <input type="tel" value={formData.mobilePro} onChange={(e) => updateField('mobilePro', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.mobilePro || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Adresse */}
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Adresse</h2>
                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="form-label">Adresse</label>
                      {isEditMode ? (
                        <input type="text" value={formData.address} onChange={(e) => updateField('address', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.address || '-'}</div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="form-group">
                        <label className="form-label">Code postal</label>
                        {isEditMode ? (
                          <input type="text" value={formData.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-0.5 text-gray-900">{formData.postalCode || '-'}</div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Ville</label>
                        {isEditMode ? (
                          <input type="text" value={formData.city} onChange={(e) => updateField('city', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-0.5 text-gray-900">{formData.city || '-'}</div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Canton</label>
                        {isEditMode ? (
                          <input type="text" value={formData.canton} onChange={(e) => updateField('canton', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-0.5 text-gray-900">{formData.canton || '-'}</div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Pays</label>
                        {isEditMode ? (
                          <input type="text" value={formData.pays} onChange={(e) => updateField('pays', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-0.5 text-gray-900">{formData.pays || '-'}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne droite */}
            <div className="space-y-4">
              {/* Contrat */}
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Contrat</h2>
                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="form-label">Secteur</label>
                      {isEditMode ? (
                        <select value={formData.secteurId} onChange={(e) => updateField('secteurId', e.target.value)} className="form-input">
                          <option value="">-- Aucun --</option>
                          {sectors.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="py-0.5 text-gray-900">{getSectorName(formData.secteurId)}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Type de contrat</label>
                      {isEditMode ? (
                        <select value={formData.contratType} onChange={(e) => updateField('contratType', e.target.value)} className="form-input">
                          <option value="">-- Aucun --</option>
                          <option value="CDI">CDI</option>
                          <option value="CDD">CDD</option>
                          <option value="Mixte">Mixte</option>
                        </select>
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.contratType || '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Taux (%)</label>
                      {isEditMode ? (
                        <input type="number" step="0.01" min="0" max="100" value={formData.taux} onChange={(e) => updateField('taux', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.taux ? `${formData.taux}%` : '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Détails contrat</label>
                      {isEditMode ? (
                        <textarea value={formData.contratDetails} onChange={(e) => updateField('contratDetails', e.target.value)} className="form-textarea" rows={2} />
                      ) : (
                        <div className="py-0.5 text-gray-900 whitespace-pre-wrap">{formData.contratDetails || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statut */}
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Statut</h2>
                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="form-label">Date de sortie</label>
                      {isEditMode ? (
                        <DatePicker value={formData.dateSortie} onChange={(value) => updateField('dateSortie', value)} />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.dateSortie ? new Date(formData.dateSortie).toLocaleDateString('fr-FR') : '-'}</div>
                      )}
                    </div>
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

              {/* Remarques */}
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
            </div>
          </div>
        )}

        {/* Tab: Planning */}
        {activeTab === 'planning' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
            {/* Left column - Calendar */}
            <div className="space-y-4">
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                    <CalendarDaysIcon className="w-4 h-4" />
                    Calendrier
                  </h2>
                  <CollaborateurMonthCalendar
                    presences={presences}
                    remplacements={remplacements}
                    absences={absencesCollab}
                    onRemplacementClick={(r) => {
                      setEditingRemplacement(r)
                      setShowReplacementModal(true)
                    }}
                    onCellClick={(info) => setCellActionMenu(info)}
                  />

                  {/* Menu d'action au clic sur une cellule */}
                  {cellActionMenu && (
                    <div className="fixed inset-0 z-40" onClick={() => setCellActionMenu(null)}>
                      <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 min-w-[280px] z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-sm font-medium text-gray-800 mb-1">
                          {new Date(cellActionMenu.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          {' \u2022 '}{CRENEAU_LABELS[cellActionMenu.creneau]}
                        </div>
                        <div className="text-xs text-gray-500 mb-3">
                          {cellActionMenu.type === 'absence' ? 'Absence déclarée' : 'Créneau de présence'}
                        </div>
                        <div className="space-y-2">
                          {cellActionMenu.type === 'presence' && (
                            <>
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-700 border border-red-200 transition-colors"
                                onClick={() => {
                                  setPrefillDate(cellActionMenu.date)
                                  setPrefillCreneau(cellActionMenu.creneau)
                                  setCellActionMenu(null)
                                  setShowAbsenceModal(true)
                                }}
                              >
                                Déclarer une absence
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-purple-50 text-purple-700 border border-purple-200 transition-colors"
                                onClick={() => {
                                  setPrefillDate(cellActionMenu.date)
                                  setPrefillCreneau(null)
                                  setCellActionMenu(null)
                                  setShowReplacementModal(true)
                                }}
                              >
                                Annoncer un remplacement
                              </button>
                            </>
                          )}
                          {cellActionMenu.type === 'absence' && (
                            <button
                              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-purple-50 text-purple-700 border border-purple-200 transition-colors"
                              onClick={() => {
                                setPrefillDate(cellActionMenu.date)
                                setCellActionMenu(null)
                                setShowReplacementModal(true)
                              }}
                            >
                              Annoncer un remplacement
                            </button>
                          )}
                        </div>
                        <button
                          className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600"
                          onClick={() => setCellActionMenu(null)}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Absences section */}
              <div className="ds-table-container">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                      Absences ({absencesCollab.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => { setEditingAbsence(null); setShowAbsenceModal(true) }}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1"
                    >
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  {absencesCollab.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucune absence</p>
                  ) : (
                    <div className="space-y-2">
                      {absencesCollab.map((abs) => (
                        <div key={abs.id} className={`rounded-lg px-3 py-2 text-sm ${abs.isRemplacee ? 'bg-orange-50' : 'bg-red-50'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className={`font-medium ${abs.isRemplacee ? 'text-orange-800' : 'text-red-800'}`}>
                                {new Date(abs.dateDebut).toLocaleDateString('fr-FR')}
                                {abs.dateDebut !== abs.dateFin && ` - ${new Date(abs.dateFin).toLocaleDateString('fr-FR')}`}
                                {' • '}{CRENEAU_LABELS[abs.creneau]}
                              </div>
                              <div className={abs.isRemplacee ? 'text-orange-600' : 'text-red-600'}>
                                {MOTIF_LABELS[abs.motif] || abs.motif}
                                {abs.motifDetails && ` — ${abs.motifDetails}`}
                              </div>
                              <div className="text-xs mt-0.5">
                                {abs.isRemplacee ? (
                                  <span className="text-green-600">✓ Remplacée</span>
                                ) : (
                                  <span className="text-red-500">✗ Non remplacée</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => { setEditingAbsence(abs); setShowAbsenceModal(true) }}
                                className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                                title="Modifier"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAbsence(abs.id)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Supprimer"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Remplacements list */}
              <div className="ds-table-container">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                      Remplacements ({remplacements.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => { setEditingRemplacement(null); setShowReplacementModal(true) }}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1"
                    >
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  {remplacements.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucun remplacement</p>
                  ) : (
                    <div className="space-y-2">
                      {remplacements.slice(0, 10).map((r) => (
                        <div key={r.id} className="bg-purple-50 rounded-lg px-3 py-2 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-purple-800">
                                {new Date(r.dateDebut).toLocaleDateString('fr-FR')}
                                {r.dateDebut !== r.dateFin && ` - ${new Date(r.dateFin).toLocaleDateString('fr-FR')}`}
                                {' \u2022 '}{CRENEAU_LABELS[r.creneau]}
                              </div>
                              <div className="text-purple-600">
                                Remplacé par{' '}
                                <Link href={`/remplacants/${r.remplacantId}`} className="hover:underline">
                                  {r.remplacantPrenom} {r.remplacantNom}
                                </Link>
                                {r.ecoleNom && ` (${r.ecoleNom})`}
                              </div>
                              {r.motif && <div className="text-xs text-gray-500 mt-1">Motif: {r.motif}</div>}
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => { setEditingRemplacement(r); setShowReplacementModal(true) }}
                                className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                                title="Changer le remplaçant"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRemplacement(r.id)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Supprimer le remplacement"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {remplacements.length > 10 && (
                        <p className="text-xs text-gray-500">... et {remplacements.length - 10} autres</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Affectations */}
            <div className="space-y-4">
              <div className="ds-table-container">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                      <BuildingOfficeIcon className="w-4 h-4" />
                      Affectations ({affectations.length})
                    </h2>
                    <button
                      type="button"
                      onClick={openAddAffectation}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1"
                    >
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  {affectations.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucune affectation</p>
                  ) : (
                    <div className="space-y-2">
                      {affectations.map((aff) => {
                        let joursPresence: JourPresence[] = []
                        if (aff.joursPresence) {
                          try {
                            joursPresence = JSON.parse(aff.joursPresence)
                          } catch {
                            joursPresence = []
                          }
                        }
                        return (
                          <div key={aff.id} className="bg-green-50 rounded-lg px-3 py-2 text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-green-800">
                                  <Link href={`/ecoles/${aff.ecoleId}`} className="hover:underline">
                                    {aff.ecoleName}
                                  </Link>
                                  {aff.etablissementName && (
                                    <span className="text-green-600 font-normal ml-1">({aff.etablissementName})</span>
                                  )}
                                </div>
                                {aff.periodeCode && (
                                  <div className="text-green-600 text-xs">
                                    Période: {aff.periodeCode}
                                  </div>
                                )}
                                <div className="text-green-600 text-xs">
                                  {joursPresence.length > 0
                                    ? joursPresence
                                        .map(
                                          (jp) =>
                                            `${jp.jour.charAt(0).toUpperCase() + jp.jour.slice(1, 2)} (${
                                              CRENEAU_LABELS[jp.creneau]
                                            })`
                                        )
                                        .join(', ')
                                    : 'Aucun jour défini'}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditAffectation(aff)}
                                  className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                                  title="Modifier"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAffectation(aff.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Supprimer"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions - only in edit mode */}
        {isEditMode && (
          <div className="flex justify-between items-center mt-4">
            <button type="button" onClick={handleDelete} className="text-gray-400 hover:text-red-600 p-2 transition-colors" title="Supprimer ce collaborateur">
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

      {/* Modal Absence */}
      <AbsenceModal
        isOpen={showAbsenceModal}
        onClose={() => { setShowAbsenceModal(false); setEditingAbsence(null); setPrefillDate(null); setPrefillCreneau(null) }}
        onSave={handleSaveAbsence}
        editingAbsence={editingAbsence || undefined}
        prefillDate={prefillDate || undefined}
        prefillCreneau={prefillCreneau || undefined}
      />

      {/* Modal Remplacement */}
      <ReplacementModal
        collaborateurId={parseInt(id)}
        presences={presences}
        isOpen={showReplacementModal}
        onClose={() => { setShowReplacementModal(false); setEditingRemplacement(null); setPrefillDate(null) }}
        onSave={handleSaveReplacement}
        onUpdate={handleUpdateReplacement}
        editingRemplacement={editingRemplacement || undefined}
        prefillDate={prefillDate || undefined}
      />

      {/* Modal Affectation */}
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

      {showAffectationModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-lg">
            <div className="modal-header">
              <h3 className="text-lg font-semibold">
                {editingAffectation ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
              </h3>
              <button
                onClick={() => setShowAffectationModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="space-y-4">
                {/* École */}
                <div className="form-group">
                  <label className="form-label">École *</label>
                  <select
                    value={affectationForm.ecoleId}
                    onChange={(e) => setAffectationForm(prev => ({ ...prev, ecoleId: e.target.value }))}
                    className="form-input"
                    disabled={!!editingAffectation}
                  >
                    <option value="">-- Sélectionner --</option>
                    {ecoles.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} {e.etablissementName && `(${e.etablissementName})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Période */}
                <div className="form-group">
                  <label className="form-label">Période scolaire</label>
                  <select
                    value={affectationForm.periodeId}
                    onChange={(e) => setAffectationForm(prev => ({ ...prev, periodeId: e.target.value }))}
                    className="form-input"
                  >
                    <option value="">-- Aucune --</option>
                    {periodes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Jours de présence */}
                <div className="form-group">
                  <label className="form-label">Jours de présence</label>
                  <p className="text-xs text-gray-500 mb-2">Cliquez sur les cases pour activer/désactiver</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-xs font-medium text-gray-500"></th>
                          {JOURS_SEMAINE.map((jour) => (
                            <th key={jour} className="p-2 text-xs font-medium text-gray-500 text-center">
                              {JOUR_LABELS[jour]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CRENEAUX.filter(c => c !== 'journee').map((creneau) => (
                          <tr key={creneau} className="border-t">
                            <td className="p-2 text-xs font-medium text-gray-600">
                              {CRENEAU_LABELS[creneau]}
                            </td>
                            {JOURS_SEMAINE.map((jour) => (
                              <td key={`${jour}-${creneau}`} className="p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleJourPresence(jour, creneau)}
                                  className={`w-8 h-8 rounded border-2 transition-colors ${
                                    isJourSelected(jour, creneau)
                                      ? 'bg-green-500 border-green-600 text-white'
                                      : 'bg-white border-gray-300 hover:border-green-400'
                                  }`}
                                >
                                  {isJourSelected(jour, creneau) && '✓'}
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {affectationForm.joursPresence.length} créneau(x) sélectionné(s)
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowAffectationModal(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveAffectation}
                className="btn btn-primary"
              >
                {editingAffectation ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
