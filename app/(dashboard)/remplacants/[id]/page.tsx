'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, UserGroupIcon, TrashIcon, PlusIcon, ChatBubbleLeftIcon, EyeIcon, PencilIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import {
  MonthCalendar,
  AbsenceModal,
  RemplacantReplacementModal,
  DisponibiliteSpecifique,
  Affectation,
  AbsenceData,
  VacancesScolaires,
  Creneau,
  formatDate,
  CRENEAU_LABELS,
  MOTIF_LABELS,
} from '@/components/planning'
import DisponibiliteModal from '@/components/planning/DisponibiliteModal'
import type { RemplacantSelectedCell } from '@/components/planning/MonthCalendar'
import { DatePicker, PhoneInput } from '@/components/ui'
import RemarqueModal from '@/components/modals/RemarqueModal'
import SeanceObservationModal from '@/components/modals/SeanceObservationModal'

interface Remarque {
  id: number
  content: string
  createdAt: string
  createdByName: string | null
  createdByEmail: string | null
}

interface SeanceObservation {
  id: number
  remplacantObserveId: number
  observateurType: 'remplacant' | 'collaborateur'
  observateurRemplacantId: number | null
  observateurCollaborateurId: number | null
  ecoleId: number
  date: string
  creneau: string
  note: string | null
  ecoleName: string
  observateurRemplacantLastName: string | null
  observateurRemplacantFirstName: string | null
  observateurCollaborateurLastName: string | null
  observateurCollaborateurFirstName: string | null
}

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

interface RemplacantAbsenceTab {
  id: number
  dateDebut: string
  dateFin: string
  creneau: string
  motif: string
  motifDetails: string | null
  affectationsImpactees?: Array<{
    id: number
    collaborateurPrenom: string | null
    collaborateurNom: string | null
    ecoleNom: string | null
    dateDebut: string
    dateFin: string
    creneau: string
  }>
}

interface RemplacantAffectationTab {
  id: number
  collaborateurId: number
  collaborateurNom: string | null
  collaborateurPrenom: string | null
  collaborateurEmail: string | null
  collaborateurMobilePro: string | null
  ecoleId: number
  ecoleNom: string | null
  directeurNom: string | null
  directeurPrenom: string | null
  directeurEmail: string | null
  directeurPhone: string | null
  titulairesNoms: string | null
  titulairesEmails: string | null
  titulairesPhones: string | null
  dateDebut: string
  dateFin: string
  creneau: string
  motif: string | null
  isActive: boolean
}

type TabType = 'planning' | 'absences' | 'remplacements' | 'observations' | 'informations'

export default function RemplacantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const initialTab = (searchParams.get('tab') as TabType) || 'planning'
  const [activeTab, setActiveTab] = useState<TabType>(
    ['planning', 'absences', 'remplacements', 'observations', 'informations'].includes(initialTab) ? initialTab : 'planning'
  )
  const [remarques, setRemarques] = useState<Remarque[]>([])
  const [seances, setSeances] = useState<SeanceObservation[]>([])
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([])
  const [remplacantsList, setRemplacantsList] = useState<RemplacantOption[]>([])
  const [ecolesList, setEcolesList] = useState<EcoleOption[]>([])

  // Tabs lazy data
  const [tabAbsences, setTabAbsences] = useState<RemplacantAbsenceTab[]>([])
  const [tabAbsencesLoaded, setTabAbsencesLoaded] = useState(false)
  const [tabAbsencesLoading, setTabAbsencesLoading] = useState(false)
  const [tabAffectations, setTabAffectations] = useState<RemplacantAffectationTab[]>([])
  const [tabAffectationsLoaded, setTabAffectationsLoaded] = useState(false)
  const [tabAffectationsLoading, setTabAffectationsLoading] = useState(false)
  const [affFilter, setAffFilter] = useState<'all' | 'past' | 'future'>('future')
  const [affSearch, setAffSearch] = useState('')

  const [showAddRemarque, setShowAddRemarque] = useState(false)
  const [showAddSeance, setShowAddSeance] = useState(false)

  // Planning state
  const [specifiques, setSpecifiques] = useState<DisponibiliteSpecifique[]>([])
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [vacances, setVacances] = useState<VacancesScolaires[]>([])
  const [absencesRempl, setAbsencesRempl] = useState<AbsenceData[]>([])
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<AbsenceData | null>(null)
  const [showReplacementModal, setShowReplacementModal] = useState(false)
  const [showDisponibiliteModal, setShowDisponibiliteModal] = useState(false)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillDateFin, setPrefillDateFin] = useState<string | null>(null)
  const [prefillCreneau, setPrefillCreneau] = useState<Creneau | null>(null)

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

  // Accès portail
  const [accessEmail, setAccessEmail] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [portalUserId, setPortalUserId] = useState<string | null>(null)
  const [portalEmail, setPortalEmail] = useState<string | null>(null)
  const [showAccessModal, setShowAccessModal] = useState(false)

  // Fetch planning data
  const fetchPlanningData = useCallback(async () => {
    try {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const startDate = formatDate(start)
      const end = new Date(today.getFullYear(), today.getMonth() + 4, 0)
      const endDateStr = formatDate(end)

      const [specRes, affRes, vacRes, absRes] = await Promise.all([
        fetch(`/api/remplacants/${id}/disponibilites/specifiques?startDate=${startDate}&endDate=${endDateStr}`),
        fetch(`/api/remplacants/${id}/affectations?startDate=${startDate}&endDate=${endDateStr}`),
        fetch(`/api/vacances-scolaires?startDate=${startDate}&endDate=${endDateStr}`),
        fetch(`/api/remplacants/${id}/absences?startDate=${startDate}&endDate=${endDateStr}`),
      ])

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
      if (absRes.ok) {
        const { data } = await absRes.json()
        setAbsencesRempl(data || [])
      }
    } catch (error) {
      console.error('Error fetching planning data:', error)
    }
  }, [id])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [remplacantRes, remarquesRes, seancesRes, collaborateursRes, remplacantsRes, ecolesRes] = await Promise.all([
          fetch(`/api/remplacants/${id}`),
          fetch(`/api/remplacants/${id}/remarques`),
          fetch(`/api/remplacants/${id}/observations`),
          fetch('/api/collaborateurs'),
          fetch('/api/remplacants'),
          fetch('/api/ecoles'),
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

        // Portal access info
        if (r.userId) {
          setPortalUserId(r.userId)
          fetch(`/api/remplacants/${id}/access`)
            .then(res => res.json())
            .then(data => { if (data.data?.email) setPortalEmail(data.data.email) })
            .catch(() => {})
        }

        const remarquesData = await remarquesRes.json()
        setRemarques(remarquesData.data || [])

        const seancesData = await seancesRes.json()
        setSeances(seancesData.data || [])

        const collaborateursData = await collaborateursRes.json()
        setCollaborateurs(collaborateursData.data || [])

        const remplacantsData = await remplacantsRes.json()
        setRemplacantsList(remplacantsData.data || [])

        const ecolesData = await ecolesRes.json()
        setEcolesList(ecolesData.data || [])

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

  // Lazy load tab data
  useEffect(() => {
    if (activeTab === 'absences' && !tabAbsencesLoaded && !tabAbsencesLoading) {
      setTabAbsencesLoading(true)
      fetch(`/api/remplacants/${id}/absences`)
        .then(res => res.json())
        .then(({ data }) => { setTabAbsences(data || []); setTabAbsencesLoaded(true) })
        .catch(console.error)
        .finally(() => setTabAbsencesLoading(false))
    }
    if (activeTab === 'remplacements' && !tabAffectationsLoaded && !tabAffectationsLoading) {
      setTabAffectationsLoading(true)
      fetch(`/api/remplacants/${id}/affectations?activeOnly=false`)
        .then(res => res.json())
        .then(({ data }) => { setTabAffectations(data || []); setTabAffectationsLoaded(true) })
        .catch(console.error)
        .finally(() => setTabAffectationsLoading(false))
    }
  }, [activeTab, id, tabAbsencesLoaded, tabAbsencesLoading, tabAffectationsLoaded, tabAffectationsLoading])

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

  const handleAddRemarque = async (texte: string) => {
    try {
      const res = await fetch(`/api/remplacants/${id}/remarques`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: texte }),
      })
      if (res.ok) {
        const data = await res.json()
        setRemarques(prev => [data.data, ...prev])
        setShowAddRemarque(false)
      }
    } catch (error) {
      console.error('Error adding remarque:', error)
    }
  }

  const handleSeanceSuccess = (data: { data: unknown }) => {
    setSeances(prev => [data.data as SeanceObservation, ...prev])
    setShowAddSeance(false)
  }

  const handleRemoveSeance = async (seanceId: number) => {
    if (!confirm('Supprimer cette séance d\'observation ?')) return
    try {
      const res = await fetch(`/api/remplacants/${id}/observations?seanceId=${seanceId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setSeances(prev => prev.filter(s => s.id !== seanceId))
      }
    } catch (error) {
      console.error('Error removing seance:', error)
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

  // ─── Absence handlers ─────────────────────────────────────
  const handleSaveAbsence = async (data: {
    dateDebut: string
    dateFin: string
    creneau: Creneau
    motif: string
    motifDetails?: string
  }) => {
    if (editingAbsence) {
      const res = await fetch(`/api/remplacants/${id}/absences`, {
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
      const res = await fetch(`/api/remplacants/${id}/absences`, {
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
      const res = await fetch(`/api/remplacants/${id}/absences?absenceId=${absenceId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchPlanningData()
        setTabAbsences(prev => prev.filter(a => a.id !== absenceId))
      }
    } catch (error) {
      console.error('Error deleting absence:', error)
    }
  }

  // ─── Affectation delete handler ──────────────────────────
  const handleDeleteAffectation = async (affectationId: number) => {
    if (!confirm('Supprimer cette affectation ?')) return
    try {
      const res = await fetch(`/api/remplacants/${id}/affectations?affectationId=${affectationId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchPlanningData()
      }
    } catch (error) {
      console.error('Error deleting affectation:', error)
    }
  }

  // ─── Replacement handler ─────────────────────────────────
  const handleSaveReplacement = async (data: {
    collaborateurId: number
    remplacantId: number
    dateDebut: string
    dateFin: string
    entries: { ecoleId: number; date: string; creneau: Creneau }[]
    motif: string
    motifDetails?: string
  }) => {
    const res = await fetch(`/api/collaborateurs/${data.collaborateurId}/remplacements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        remplacantId: data.remplacantId,
        dateDebut: data.dateDebut,
        dateFin: data.dateFin,
        entries: data.entries,
        motif: data.motif,
        motifDetails: data.motifDetails,
      }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      alert(error || 'Erreur lors de la création du remplacement')
      throw new Error(error)
    }

    await fetchPlanningData()
  }

  // ─── Batch disponibilité handler ─────────────────────────
  const handleBatchDisponibilite = useCallback(async (
    cells: RemplacantSelectedCell[],
    isAvailable: boolean
  ) => {
    try {
      await Promise.all(
        cells.map(cell =>
          fetch(`/api/remplacants/${id}/disponibilites/specifiques`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: cell.date,
              creneau: cell.creneau,
              isAvailable,
            }),
          })
        )
      )
      await fetchPlanningData()
    } catch (error) {
      console.error('Error batch updating disponibilites:', error)
    }
  }, [id, fetchPlanningData])

  // ─── Batch effacer statut handler ──────────────────────
  const handleBatchEffacer = useCallback(async (
    cells: RemplacantSelectedCell[]
  ) => {
    try {
      await Promise.all(
        cells
          .filter(cell => cell.status === 'disponible_specifique' || cell.status === 'indisponible_exception')
          .map(cell =>
            fetch(`/api/remplacants/${id}/disponibilites/specifiques?date=${cell.date}&creneau=${cell.creneau}`, {
              method: 'DELETE',
            })
          )
      )
      await fetchPlanningData()
    } catch (error) {
      console.error('Error batch deleting disponibilites:', error)
    }
  }, [id, fetchPlanningData])

  // ─── Selection action handler ────────────────────────────
  const handleSelectionAction = useCallback((
    action: 'absence' | 'remplacement' | 'disponibilite' | 'exception' | 'effacer',
    cells: RemplacantSelectedCell[]
  ) => {
    if (action === 'disponibilite') {
      handleBatchDisponibilite(cells, true)
      return
    }
    if (action === 'exception') {
      handleBatchEffacer(cells)
      return
    }
    if (action === 'effacer') {
      handleBatchEffacer(cells)
      return
    }

    const dates = cells.map(c => c.date).sort()
    const dateDebut = dates[0]
    const dateFin = dates[dates.length - 1]
    const creneaux = new Set(cells.map(c => c.creneau))
    const commonCreneau: Creneau = creneaux.size === 1 ? cells[0].creneau : 'journee'

    if (action === 'absence') {
      setPrefillDate(dateDebut)
      setPrefillDateFin(dateFin)
      setPrefillCreneau(commonCreneau)
      setEditingAbsence(null)
      setShowAbsenceModal(true)
    } else {
      setPrefillDate(dateDebut)
      setPrefillDateFin(dateFin)
      setPrefillCreneau(commonCreneau)
      setShowReplacementModal(true)
    }
  }, [handleBatchDisponibilite, handleBatchEffacer])

  // Filter remplacements tab
  const todayStr = formatDate(new Date())
  const filteredTabAffectations = useMemo(() => {
    let filtered = tabAffectations
    if (affFilter === 'past') {
      filtered = filtered.filter(a => a.dateFin < todayStr)
    } else if (affFilter === 'future') {
      filtered = filtered.filter(a => a.dateFin >= todayStr)
    }
    if (affSearch.trim()) {
      const q = affSearch.toLowerCase()
      filtered = filtered.filter(a =>
        `${a.collaborateurPrenom} ${a.collaborateurNom}`.toLowerCase().includes(q) ||
        (a.ecoleNom || '').toLowerCase().includes(q) ||
        (a.directeurPrenom && `${a.directeurPrenom} ${a.directeurNom}`.toLowerCase().includes(q))
      )
    }
    return filtered
  }, [tabAffectations, affFilter, affSearch, todayStr])

  // Group affectations by absence (same collaborateur + école + contiguous dates)
  const groupedAffectations = useMemo(() => {
    if (filteredTabAffectations.length === 0) return []

    // Sort by collaborateur, école, date
    const sorted = [...filteredTabAffectations].sort((a, b) => {
      if (a.collaborateurId !== b.collaborateurId) return a.collaborateurId - b.collaborateurId
      if (a.ecoleId !== b.ecoleId) return a.ecoleId - b.ecoleId
      if (a.motif !== b.motif) return (a.motif || '').localeCompare(b.motif || '')
      return a.dateDebut.localeCompare(b.dateDebut)
    })

    type GroupedAff = {
      ids: number[]
      collaborateurId: number
      collaborateurNom: string | null
      collaborateurPrenom: string | null
      collaborateurEmail: string | null
      collaborateurMobilePro: string | null
      ecoleId: number
      ecoleNom: string | null
      directeurNom: string | null
      directeurPrenom: string | null
      directeurEmail: string | null
      directeurPhone: string | null
      titulairesNoms: string | null
      titulairesEmails: string | null
      titulairesPhones: string | null
      dateDebut: string
      dateFin: string
      creneaux: Set<string>
      uniqueDates: Set<string>
      motif: string | null
      isActive: boolean
    }

    const groups: GroupedAff[] = []
    let current: GroupedAff | null = null

    for (const aff of sorted) {
      const isSameGroup = current &&
        current.collaborateurId === aff.collaborateurId &&
        current.ecoleId === aff.ecoleId &&
        current.motif === aff.motif &&
        // Dates contiguës (≤ 4 jours pour couvrir les weekends + mercredi)
        (new Date(aff.dateDebut).getTime() - new Date(current.dateFin).getTime()) <= 4 * 86400000

      if (isSameGroup && current) {
        current.ids.push(aff.id)
        if (aff.dateFin > current.dateFin) current.dateFin = aff.dateFin
        if (aff.dateDebut < current.dateDebut) current.dateDebut = aff.dateDebut
        current.creneaux.add(aff.creneau)
        current.uniqueDates.add(aff.dateDebut)
      } else {
        if (current) groups.push(current)
        current = {
          ids: [aff.id],
          collaborateurId: aff.collaborateurId,
          collaborateurNom: aff.collaborateurNom,
          collaborateurPrenom: aff.collaborateurPrenom,
          collaborateurEmail: aff.collaborateurEmail,
          collaborateurMobilePro: aff.collaborateurMobilePro,
          ecoleId: aff.ecoleId,
          ecoleNom: aff.ecoleNom,
          directeurNom: aff.directeurNom,
          directeurPrenom: aff.directeurPrenom,
          directeurEmail: aff.directeurEmail,
          directeurPhone: aff.directeurPhone,
          titulairesNoms: aff.titulairesNoms,
          titulairesEmails: aff.titulairesEmails,
          titulairesPhones: aff.titulairesPhones,
          dateDebut: aff.dateDebut,
          dateFin: aff.dateFin,
          creneaux: new Set([aff.creneau]),
          uniqueDates: new Set([aff.dateDebut]),
          motif: aff.motif,
          isActive: aff.isActive,
        }
      }
    }
    if (current) groups.push(current)

    // Sort groups by dateDebut descending (most recent first)
    groups.sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))

    return groups
  }, [filteredTabAffectations])

  const getObservateurName = (seance: SeanceObservation) => {
    if (seance.observateurType === 'collaborateur') {
      return `${seance.observateurCollaborateurFirstName} ${seance.observateurCollaborateurLastName}`
    }
    return `${seance.observateurRemplacantFirstName} ${seance.observateurRemplacantLastName}`
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
              <>
                <button
                  onClick={() => { setEditingAbsence(null); setShowAbsenceModal(true) }}
                  className="btn btn-secondary"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Déclarer une absence
                </button>
                <button
                  onClick={() => setShowReplacementModal(true)}
                  className="btn btn-secondary"
                >
                  <CalendarDaysIcon className="w-4 h-4 mr-2" />
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
          {(['planning', 'absences', 'remplacements', 'observations', 'informations'] as TabType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'planning' ? 'Planning' : tab === 'absences' ? 'Absences' : tab === 'remplacements' ? 'Remplacements' : tab === 'observations' ? 'Observations' : 'Informations'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Informations — wrapped in form for edit mode */}
      {activeTab === 'informations' && (
        <form onSubmit={handleSubmit}>
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
                    </div>
                    <div className="form-group">
                      <label className="form-label">Adresse</label>
                      {isEditMode ? (
                        <input type="text" value={formData.address} onChange={(e) => updateField('address', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.address || '-'}</div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">Téléphone</label>
                        {isEditMode ? (
                          <PhoneInput value={formData.phone} onChange={(value) => updateField('phone', value)} />
                        ) : (
                          <div className="py-0.5 text-gray-900">{formData.phone || '-'}</div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        {isEditMode ? (
                          <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="form-input" />
                        ) : (
                          <div className="py-0.5 text-gray-900">{formData.email || '-'}</div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">Date début contrat</label>
                        {isEditMode ? (
                          <DatePicker value={formData.contractStartDate} onChange={(value) => updateField('contractStartDate', value)} />
                        ) : (
                          <div className="py-0.5 text-gray-900">{formData.contractStartDate ? new Date(formData.contractStartDate).toLocaleDateString('fr-FR') : '-'}</div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date fin contrat</label>
                        {isEditMode ? (
                          <DatePicker value={formData.contractEndDate} onChange={(value) => updateField('contractEndDate', value)} />
                        ) : (
                          <div className="py-0.5 text-gray-900">{formData.contractEndDate ? new Date(formData.contractEndDate).toLocaleDateString('fr-FR') : '-'}</div>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Observation temporaire</label>
                      {isEditMode ? (
                        <textarea value={formData.obsTemporaire} onChange={(e) => updateField('obsTemporaire', e.target.value)} className="form-input" rows={2} />
                      ) : (
                        <div className="py-0.5 text-gray-900 whitespace-pre-wrap">{formData.obsTemporaire || '-'}</div>
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

              {/* Accès portail */}
              <div className="ds-table-container">
                <div className="p-5">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                    Accès portail
                  </h2>
                  {portalUserId ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="status-badge-success">Accès actif</span>
                      </div>
                      {portalEmail && (
                        <p className="text-sm text-gray-600">{portalEmail}</p>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Retirer l\'accès portail de ce remplaçant ?')) return
                          try {
                            const res = await fetch(`/api/remplacants/${id}/access`, { method: 'DELETE' })
                            if (res.ok) {
                              setPortalUserId(null)
                              setPortalEmail(null)
                            }
                          } catch {}
                        }}
                        className="text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Retirer l'accès
                      </button>
                    </div>
                  ) : (
                    <div>
                      {showAccessModal ? (
                        <div className="space-y-3">
                          <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                              type="email"
                              value={accessEmail}
                              onChange={(e) => setAccessEmail(e.target.value)}
                              className="form-input"
                              placeholder="email@exemple.ch"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Mot de passe</label>
                            <input
                              type="password"
                              value={accessPassword}
                              onChange={(e) => setAccessPassword(e.target.value)}
                              className="form-input"
                              placeholder="Min. 6 caractères"
                            />
                          </div>
                          {accessError && (
                            <p className="text-sm text-red-600">{accessError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={accessLoading}
                              onClick={async () => {
                                setAccessError('')
                                setAccessLoading(true)
                                try {
                                  const res = await fetch(`/api/remplacants/${id}/access`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: accessEmail, password: accessPassword }),
                                  })
                                  const data = await res.json()
                                  if (!res.ok) {
                                    setAccessError(data.error || 'Erreur')
                                    return
                                  }
                                  setPortalUserId(data.data.userId)
                                  setPortalEmail(data.data.email)
                                  setShowAccessModal(false)
                                  setAccessEmail('')
                                  setAccessPassword('')
                                } catch {
                                  setAccessError('Erreur serveur')
                                } finally {
                                  setAccessLoading(false)
                                }
                              }}
                              className="btn btn-primary text-sm"
                            >
                              {accessLoading ? 'Création...' : 'Créer'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowAccessModal(false); setAccessError('') }}
                              className="btn btn-secondary text-sm"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAccessModal(true)
                            setAccessEmail(formData.email || '')
                          }}
                          className="btn btn-primary text-sm"
                        >
                          Créer un accès
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

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
      )}

        {/* Tab: Planning */}
        {activeTab === 'planning' && (
          <div className="space-y-4">
            <div className="ds-table-container">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                    <CalendarDaysIcon className="w-4 h-4" />
                    Calendrier
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowDisponibiliteModal(true)}
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="w-4 h-4" /> Gérer les disponibilités
                  </button>
                </div>
                <MonthCalendar
                  remplacantId={parseInt(id)}
                  specifiques={specifiques}
                  affectations={affectations}
                  absences={absencesRempl}
                  vacances={vacances}
                  onRefresh={fetchPlanningData}
                  onSelectionAction={handleSelectionAction}
                />
              </div>
            </div>

          </div>
        )}


      {/* Tab: Observations */}
      {activeTab === 'observations' && (
        <div className="space-y-4">
          {/* Séances d'observation section */}
          <div className="ds-table-container">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                  <EyeIcon className="w-4 h-4" />
                  Séances d&apos;observation ({seances.length})
                </h2>
                <button type="button" onClick={() => setShowAddSeance(true)} className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1">
                  <PlusIcon className="w-4 h-4" /> Ajouter
                </button>
              </div>
              {seances.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucune séance d&apos;observation.</p>
              ) : (
                <div className="space-y-2">
                  {seances.map((seance) => (
                    <div key={seance.id} className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(seance.date).toLocaleDateString('fr-FR')}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            {CRENEAU_LABELS[seance.creneau as Creneau] || seance.creneau}
                          </span>
                          <span className="text-sm text-gray-600">{seance.ecoleName}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-gray-700">{getObservateurName(seance)}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                            seance.observateurType === 'collaborateur'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {seance.observateurType === 'collaborateur' ? 'Collab.' : 'Rempl.'}
                          </span>
                        </div>
                        {seance.note && (
                          <p className="mt-1 text-xs text-gray-500">{seance.note}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSeance(seance.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors ml-2 flex-shrink-0"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Absences */}
      {activeTab === 'absences' && (
        <div className="ds-table-container">
          <div className="p-5">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              Absences ({tabAbsencesLoaded ? tabAbsences.length : '...'})
            </h2>
            {tabAbsencesLoading ? (
              <div className="text-center py-8">
                <div className="spinner-md mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Chargement...</p>
              </div>
            ) : tabAbsences.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Aucune absence</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="ds-table">
                  <thead>
                    <tr className="ds-table-header">
                      <th className="ds-table-header-cell">Dates</th>
                      <th className="ds-table-header-cell">Créneau</th>
                      <th className="ds-table-header-cell">Motif</th>
                      <th className="ds-table-header-cell">Affectations impactées</th>
                      <th className="ds-table-header-cell w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabAbsences.map((abs) => (
                      <tr key={abs.id} className="ds-table-row">
                        <td className="ds-table-cell whitespace-nowrap">
                          {new Date(abs.dateDebut).toLocaleDateString('fr-FR')}
                          {abs.dateDebut !== abs.dateFin && ` - ${new Date(abs.dateFin).toLocaleDateString('fr-FR')}`}
                        </td>
                        <td className="ds-table-cell">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            {CRENEAU_LABELS[abs.creneau as Creneau] || abs.creneau}
                          </span>
                        </td>
                        <td className="ds-table-cell">
                          <div>{MOTIF_LABELS[abs.motif] || abs.motif}</div>
                          {abs.motifDetails && <div className="text-xs text-gray-500">{abs.motifDetails}</div>}
                        </td>
                        <td className="ds-table-cell">
                          {abs.affectationsImpactees && abs.affectationsImpactees.length > 0 ? (
                            <div className="space-y-0.5">
                              {abs.affectationsImpactees.map((a) => (
                                <div key={a.id} className="text-xs text-orange-600">
                                  {a.collaborateurPrenom} {a.collaborateurNom} ({a.ecoleNom})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="ds-table-cell">
                          <button
                            type="button"
                            onClick={() => handleDeleteAbsence(abs.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Remplacements */}
      {activeTab === 'remplacements' && (
        <div className="ds-table-container">
          <div className="p-5">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              Remplacements ({tabAffectationsLoaded ? groupedAffectations.length : '...'})
            </h2>

            {/* Filtres */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {([['future', 'À venir'], ['past', 'Passés'], ['all', 'Tous']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAffFilter(value)}
                    className={`px-3 py-1.5 transition-colors ${
                      affFilter === value
                        ? 'bg-purple-100 text-purple-700 font-medium'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Rechercher collaborateur, école..."
                value={affSearch}
                onChange={(e) => setAffSearch(e.target.value)}
                className="form-input py-1.5 text-sm flex-1 min-w-[200px]"
              />
            </div>

            {tabAffectationsLoading ? (
              <div className="text-center py-8">
                <div className="spinner-md mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Chargement...</p>
              </div>
            ) : groupedAffectations.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                {tabAffectations.length === 0 ? 'Aucun remplacement' : 'Aucun résultat pour ces filtres'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="ds-table">
                  <thead>
                    <tr className="ds-table-header">
                      <th className="ds-table-header-cell">Remplace</th>
                      <th className="ds-table-header-cell">École</th>
                      <th className="ds-table-header-cell">Début</th>
                      <th className="ds-table-header-cell">Fin</th>
                      <th className="ds-table-header-cell">Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedAffectations.map((grp) => (
                      <tr
                        key={grp.ids.join('-')}
                        className="ds-table-row cursor-pointer hover:bg-purple-50"
                        onClick={() => router.push(`/remplacants/${id}/remplacement?ids=${grp.ids.join(',')}`)}
                      >
                        <td className="ds-table-cell">
                          {grp.collaborateurPrenom || grp.collaborateurNom ? (
                            <div>{grp.collaborateurPrenom} {grp.collaborateurNom}</div>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="ds-table-cell">
                          {grp.ecoleNom || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="ds-table-cell whitespace-nowrap">
                          {new Date(grp.dateDebut).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="ds-table-cell whitespace-nowrap">
                          {new Date(grp.dateFin).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="ds-table-cell whitespace-nowrap text-gray-600">
                          {grp.ids.length} cr. / {grp.uniqueDates.size} j.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Disponibilité */}
      <DisponibiliteModal
        remplacantId={parseInt(id)}
        isOpen={showDisponibiliteModal}
        onClose={() => setShowDisponibiliteModal(false)}
        onSave={fetchPlanningData}
      />

      {/* Modal Absence */}
      <AbsenceModal
        isOpen={showAbsenceModal}
        onClose={() => { setShowAbsenceModal(false); setEditingAbsence(null); setPrefillDate(null); setPrefillDateFin(null); setPrefillCreneau(null) }}
        onSave={handleSaveAbsence}
        editingAbsence={editingAbsence || undefined}
        prefillDate={prefillDate || undefined}
        prefillDateFin={prefillDateFin || undefined}
        prefillCreneau={prefillCreneau || undefined}
      />

      {/* Modal Remplacement */}
      <RemplacantReplacementModal
        remplacantId={parseInt(id)}
        isOpen={showReplacementModal}
        onClose={() => { setShowReplacementModal(false); setPrefillDate(null); setPrefillDateFin(null); setPrefillCreneau(null) }}
        onSave={handleSaveReplacement}
        prefillDate={prefillDate || undefined}
        prefillDateFin={prefillDateFin || undefined}
      />

      {/* Add Remarque Modal */}
      <RemarqueModal
        isOpen={showAddRemarque}
        onClose={() => setShowAddRemarque(false)}
        onSubmit={handleAddRemarque}
      />

      {/* Add Séance Modal */}
      <SeanceObservationModal
        isOpen={showAddSeance}
        onClose={() => setShowAddSeance(false)}
        remplacantId={id}
        collaborateurs={collaborateurs}
        remplacantsList={remplacantsList}
        ecolesList={ecolesList}
        onSuccess={handleSeanceSuccess}
      />
    </div>
  )
}
