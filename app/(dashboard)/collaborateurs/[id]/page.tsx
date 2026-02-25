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
  VacancesScolaires,
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
import type { SelectedCell } from '@/components/planning/CollaborateurMonthCalendar'
import { DatePicker, PhoneInput } from '@/components/ui'

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
  userId: string | null
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

interface CollabAbsenceTab {
  id: number
  dateDebut: string
  dateFin: string
  creneau: string
  motif: string
  motifDetails: string | null
  isRemplacee: boolean
  remplacement: {
    id: number
    remplacantId: number
    remplacantNom: string | null
    remplacantPrenom: string | null
  } | null
}

interface CollabRemplacementTab {
  id: number
  remplacantId: number
  remplacantNom: string | null
  remplacantPrenom: string | null
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
}

type TabType = 'planning' | 'absences' | 'remplacements' | 'informations'

export default function CollaborateurDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('planning')
  const [sectors, setSectors] = useState<Sector[]>([])
  const [remplacements, setRemplacements] = useState<Remplacement[]>([])
  const [presences, setPresences] = useState<Presence[]>([])
  const [absencesCollab, setAbsencesCollab] = useState<AbsenceData[]>([])
  const [vacances, setVacances] = useState<VacancesScolaires[]>([])
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<AbsenceData | null>(null)
  const [showReplacementModal, setShowReplacementModal] = useState(false)
  const [editingRemplacement, setEditingRemplacement] = useState<Remplacement | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillDateFin, setPrefillDateFin] = useState<string | null>(null)
  const [prefillCreneau, setPrefillCreneau] = useState<Creneau | null>(null)
  const [replacementSkipMotif, setReplacementSkipMotif] = useState(false)

  // Tabs lazy data
  const [tabAbsences, setTabAbsences] = useState<CollabAbsenceTab[]>([])
  const [tabAbsencesLoaded, setTabAbsencesLoaded] = useState(false)
  const [tabAbsencesLoading, setTabAbsencesLoading] = useState(false)
  const [tabRemplacements, setTabRemplacements] = useState<CollabRemplacementTab[]>([])
  const [tabRemplacementsLoaded, setTabRemplacementsLoaded] = useState(false)
  const [tabRemplacementsLoading, setTabRemplacementsLoading] = useState(false)

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

  // Accès portail
  const [accessEmail, setAccessEmail] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [portalUserId, setPortalUserId] = useState<string | null>(null)
  const [portalEmail, setPortalEmail] = useState<string | null>(null)
  const [showAccessModal, setShowAccessModal] = useState(false)

  // Fetch planning data for a 3-month range
  const fetchPlanningData = useCallback(async () => {
    try {
      const today = new Date()
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0)
      const startDateStr = formatDate(startDate)
      const endDateStr = formatDate(endDate)

      const [planRes, absRes, vacRes] = await Promise.all([
        fetch(`/api/collaborateurs/${id}/planning?startDate=${startDateStr}&endDate=${endDateStr}`),
        fetch(`/api/collaborateurs/${id}/absences?startDate=${startDateStr}&endDate=${endDateStr}`),
        fetch(`/api/vacances-scolaires?startDate=${startDateStr}&endDate=${endDateStr}`),
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
      if (vacRes.ok) {
        const { data } = await vacRes.json()
        setVacances(data || [])
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

        // Portal access info
        if (c.userId) {
          setPortalUserId(c.userId)
          fetch(`/api/collaborateurs/${id}/access`)
            .then(res => res.json())
            .then(data => { if (data.data?.email) setPortalEmail(data.data.email) })
            .catch(() => {})
        }

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

  // Lazy load tab data
  useEffect(() => {
    if (activeTab === 'absences' && !tabAbsencesLoaded && !tabAbsencesLoading) {
      setTabAbsencesLoading(true)
      fetch(`/api/collaborateurs/${id}/absences`)
        .then(res => res.json())
        .then(({ data }) => { setTabAbsences(data || []); setTabAbsencesLoaded(true) })
        .catch(console.error)
        .finally(() => setTabAbsencesLoading(false))
    }
    if (activeTab === 'remplacements' && !tabRemplacementsLoaded && !tabRemplacementsLoading) {
      setTabRemplacementsLoading(true)
      fetch(`/api/collaborateurs/${id}/remplacements`)
        .then(res => res.json())
        .then(({ data }) => { setTabRemplacements(data || []); setTabRemplacementsLoaded(true) })
        .catch(console.error)
        .finally(() => setTabRemplacementsLoading(false))
    }
  }, [activeTab, id, tabAbsencesLoaded, tabAbsencesLoading, tabRemplacementsLoaded, tabRemplacementsLoading])

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
    // Expand 'journee' entries into 'matin' + 'apres_midi' for the grid display
    const expandedJours: JourPresence[] = []
    for (const jp of jours) {
      if (jp.creneau === 'journee') {
        expandedJours.push({ jour: jp.jour, creneau: 'matin' })
        expandedJours.push({ jour: jp.jour, creneau: 'apres_midi' })
      } else {
        expandedJours.push(jp)
      }
    }
    setAffectationForm({
      ecoleId: aff.ecoleId.toString(),
      periodeId: aff.periodeId?.toString() || '',
      joursPresence: expandedJours,
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

    // Consolidate matin+apres_midi back into journee for storage
    const consolidatedJours: JourPresence[] = []
    const joursByDay = new Map<string, Set<string>>()
    for (const jp of affectationForm.joursPresence) {
      if (!joursByDay.has(jp.jour)) joursByDay.set(jp.jour, new Set())
      joursByDay.get(jp.jour)!.add(jp.creneau)
    }
    for (const [jour, creneaux] of joursByDay) {
      if (creneaux.has('matin') && creneaux.has('apres_midi')) {
        consolidatedJours.push({ jour: jour as JourSemaine, creneau: 'journee' })
      } else {
        for (const c of creneaux) {
          consolidatedJours.push({ jour: jour as JourSemaine, creneau: c as Creneau })
        }
      }
    }

    const payload = {
      ecoleId: parseInt(affectationForm.ecoleId),
      periodeId: affectationForm.periodeId ? parseInt(affectationForm.periodeId) : null,
      joursPresence: consolidatedJours,
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
        setTabAbsences(prev => prev.filter(a => a.id !== absenceId))
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
    skipAbsenceCreation?: boolean
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

  // ─── Batch delete handlers ──────────────────────────────
  const handleBatchDeleteAbsences = useCallback(async (cells: SelectedCell[]) => {
    const absenceCells = cells.filter(c => c.type === 'absence')
    if (absenceCells.length === 0) return

    // Find unique absence IDs matching selected cells
    const absenceIds = new Set<number>()
    for (const cell of absenceCells) {
      const matching = absencesCollab.find(a => {
        const inRange = cell.date >= a.dateDebut && cell.date <= a.dateFin
        const creneauMatch = a.creneau === cell.creneau || a.creneau === 'journee' || cell.creneau === 'journee'
        return inRange && creneauMatch
      })
      if (matching) absenceIds.add(matching.id)
    }

    if (absenceIds.size === 0) return
    if (!confirm(`Supprimer ${absenceIds.size} absence${absenceIds.size > 1 ? 's' : ''} ?`)) return

    try {
      await Promise.all(
        Array.from(absenceIds).map(absenceId =>
          fetch(`/api/collaborateurs/${id}/absences?absenceId=${absenceId}`, { method: 'DELETE' })
        )
      )
      await fetchPlanningData()
    } catch (error) {
      console.error('Error batch deleting absences:', error)
    }
  }, [id, absencesCollab, fetchPlanningData])

  const handleBatchDeleteRemplacements = useCallback(async (cells: SelectedCell[]) => {
    const replCells = cells.filter(c => c.type === 'remplacement')
    if (replCells.length === 0) return

    // Find unique affectation IDs matching selected cells
    const affectationIds = new Set<number>()
    for (const cell of replCells) {
      const matching = remplacements.filter(r => {
        const inRange = cell.date >= r.dateDebut && cell.date <= r.dateFin
        const creneauMatch = r.creneau === cell.creneau || r.creneau === 'journee' || cell.creneau === 'journee'
        return inRange && creneauMatch
      })
      for (const r of matching) affectationIds.add(r.id)
    }

    if (affectationIds.size === 0) return
    if (!confirm(`Supprimer ${affectationIds.size} remplacement${affectationIds.size > 1 ? 's' : ''} ?`)) return

    try {
      await Promise.all(
        Array.from(affectationIds).map(affectationId =>
          fetch(`/api/collaborateurs/${id}/remplacements?affectationId=${affectationId}`, { method: 'DELETE' })
        )
      )
      await fetchPlanningData()
    } catch (error) {
      console.error('Error batch deleting remplacements:', error)
    }
  }, [id, remplacements, fetchPlanningData])

  // ─── Multi-selection handler ──────────────────────────────
  const handleSelectionAction = useCallback((
    action: 'absence' | 'remplacement' | 'supprimer_absence' | 'supprimer_remplacement',
    cells: SelectedCell[]
  ) => {
    if (action === 'supprimer_absence') {
      handleBatchDeleteAbsences(cells)
      return
    }
    if (action === 'supprimer_remplacement') {
      handleBatchDeleteRemplacements(cells)
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
      // If selected cells already have replacements, open in edit mode
      const replacementCells = cells.filter(c => c.type === 'remplacement')
      if (replacementCells.length > 0) {
        const firstCell = replacementCells[0]
        const existingRepl = remplacements.find(r => {
          const inRange = firstCell.date >= r.dateDebut && firstCell.date <= r.dateFin
          const creneauMatch = r.creneau === firstCell.creneau || r.creneau === 'journee' || firstCell.creneau === 'journee'
          return inRange && creneauMatch
        })
        if (existingRepl) {
          setEditingRemplacement(existingRepl)
          setShowReplacementModal(true)
          return
        }
      }

      setPrefillDate(dateDebut)
      setPrefillDateFin(dateFin)
      setPrefillCreneau(commonCreneau)
      setEditingRemplacement(null)
      setReplacementSkipMotif(cells.every(c => c.type === 'absence'))
      setShowReplacementModal(true)
    }
  }, [handleBatchDeleteAbsences, handleBatchDeleteRemplacements, remplacements])

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
          {(['planning', 'absences', 'remplacements', 'informations'] as TabType[]).map((tab) => (
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
              {tab === 'planning' ? 'Planning' : tab === 'absences' ? 'Absences' : tab === 'remplacements' ? 'Remplacements' : 'Informations'}
            </button>
          ))}
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
                        <PhoneInput value={formData.mobilePro} onChange={(value) => updateField('mobilePro', value)} />
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
                          if (!confirm('Retirer l\'accès portail de ce collaborateur ?')) return
                          try {
                            const res = await fetch(`/api/collaborateurs/${id}/access`, { method: 'DELETE' })
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
                                  const res = await fetch(`/api/collaborateurs/${id}/access`, {
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
        )}

        {/* Tab: Planning */}
        {activeTab === 'planning' && (
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
                  vacances={vacances}
                  onRemplacementClick={(r) => {
                    setEditingRemplacement(r)
                    setShowReplacementModal(true)
                  }}
                  onSelectionAction={handleSelectionAction}
                />
              </div>
            </div>

            {/* Affectations */}
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
                      <th className="ds-table-header-cell">Statut</th>
                      <th className="ds-table-header-cell">Remplaçant</th>
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
                          {abs.isRemplacee ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Remplacée</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Non remplacée</span>
                          )}
                        </td>
                        <td className="ds-table-cell">
                          {abs.remplacement ? (
                            <Link href={`/remplacants/${abs.remplacement.remplacantId}`} className="text-purple-600 hover:underline">
                              {abs.remplacement.remplacantPrenom} {abs.remplacement.remplacantNom}
                            </Link>
                          ) : (
                            <span className="text-gray-400">-</span>
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
              Remplacements ({tabRemplacementsLoaded ? tabRemplacements.length : '...'})
            </h2>
            {tabRemplacementsLoading ? (
              <div className="text-center py-8">
                <div className="spinner-md mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Chargement...</p>
              </div>
            ) : tabRemplacements.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Aucun remplacement</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="ds-table">
                  <thead>
                    <tr className="ds-table-header">
                      <th className="ds-table-header-cell">Remplaçant</th>
                      <th className="ds-table-header-cell">École</th>
                      <th className="ds-table-header-cell">Directeur</th>
                      <th className="ds-table-header-cell">Titulaire(s)</th>
                      <th className="ds-table-header-cell">Créneau</th>
                      <th className="ds-table-header-cell">Dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabRemplacements.map((r) => (
                      <tr key={r.id} className="ds-table-row">
                        <td className="ds-table-cell">
                          <Link href={`/remplacants/${r.remplacantId}`} className="text-purple-600 hover:underline font-medium">
                            {r.remplacantPrenom} {r.remplacantNom}
                          </Link>
                        </td>
                        <td className="ds-table-cell">
                          <Link href={`/ecoles/${r.ecoleId}`} className="text-purple-600 hover:underline">
                            {r.ecoleNom}
                          </Link>
                        </td>
                        <td className="ds-table-cell">
                          {r.directeurPrenom || r.directeurNom ? (
                            <div>
                              <div>{r.directeurPrenom} {r.directeurNom}</div>
                              <div className="text-xs text-gray-500 space-y-0.5">
                                {r.directeurEmail && <div><a href={`mailto:${r.directeurEmail}`} className="hover:underline">{r.directeurEmail}</a></div>}
                                {r.directeurPhone && <div><a href={`tel:${r.directeurPhone}`} className="hover:underline">{r.directeurPhone}</a></div>}
                              </div>
                            </div>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="ds-table-cell">
                          {r.titulairesNoms ? (
                            <div>
                              <div>{r.titulairesNoms}</div>
                              <div className="text-xs text-gray-500 space-y-0.5">
                                {r.titulairesEmails && <div>{r.titulairesEmails.split(', ').map((e, i) => <span key={i}>{i > 0 && ', '}<a href={`mailto:${e}`} className="hover:underline">{e}</a></span>)}</div>}
                                {r.titulairesPhones && <div>{r.titulairesPhones.split(', ').map((p, i) => <span key={i}>{i > 0 && ', '}<a href={`tel:${p}`} className="hover:underline">{p}</a></span>)}</div>}
                              </div>
                            </div>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="ds-table-cell">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            {CRENEAU_LABELS[r.creneau as Creneau] || r.creneau}
                          </span>
                        </td>
                        <td className="ds-table-cell whitespace-nowrap">
                          {new Date(r.dateDebut).toLocaleDateString('fr-FR')}
                          {r.dateDebut !== r.dateFin && ` - ${new Date(r.dateFin).toLocaleDateString('fr-FR')}`}
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
      <ReplacementModal
        collaborateurId={parseInt(id)}
        presences={presences}
        isOpen={showReplacementModal}
        onClose={() => { setShowReplacementModal(false); setEditingRemplacement(null); setPrefillDate(null); setPrefillDateFin(null); setPrefillCreneau(null); setReplacementSkipMotif(false) }}
        onSave={handleSaveReplacement}
        onUpdate={handleUpdateReplacement}
        editingRemplacement={editingRemplacement || undefined}
        prefillDate={prefillDate || undefined}
        prefillDateFin={prefillDateFin || undefined}
        prefillCreneau={prefillCreneau || undefined}
        skipMotif={replacementSkipMotif}
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
                          {JOURS_SEMAINE.filter(j => j !== 'mercredi').map((jour) => (
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
                            {JOURS_SEMAINE.filter(j => j !== 'mercredi').map((jour) => (
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
