'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDaysIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, UserPlusIcon, MagnifyingGlassCircleIcon, TrashIcon, ChatBubbleLeftRightIcon, PlusIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { DateRangePicker } from '@/components/ui'

interface JourPresence {
  jour: string
  creneau: string
}

type UrgencyLevel = 'urgent' | 'warning' | 'normal' | 'no_deadline' | 'replaced'

interface AbsenceEcole {
  id: number
  name: string
  joursPresence: string | null
  remplacementApresJours: number | null
  isRemplacee: boolean
  urgency: UrgencyLevel
  joursRestants: number | null
}

interface WhatsappDisponible {
  remplacantId: number
  nom: string | null
  prenom: string | null
}

interface AbsenceRow {
  id: number
  type: 'collaborateur' | 'remplacant'
  collaborateurId: number | null
  remplacantId: number | null
  personId: number | null
  personFirstName: string | null
  personLastName: string | null
  dateDebut: string
  dateFin: string
  creneau: 'matin' | 'apres_midi' | 'journee'
  motif: 'maladie' | 'conge' | 'formation' | 'autre'
  motifDetails: string | null
  isActive: boolean
  isRemplacee: boolean
  replacementStatus: 'none' | 'partial' | 'full'
  remplacementRemplacantId: number | null
  remplacementRemplacantNom: string | null
  remplacementRemplacantPrenom: string | null
  remplacants: { id: number; nom: string | null; prenom: string | null }[]
  collaborateurEcoles: AbsenceEcole[]
  urgency: UrgencyLevel
  joursRestants: number | null
  whatsappSent: number
  whatsappDisponible: WhatsappDisponible[]
  whatsappPasDisponible: number
  whatsappEnAttente: number
}

interface RemplacantOption {
  id: number
  lastName: string
  firstName: string
  phone?: string | null
  email?: string | null
}

interface WhatsappResponseRow {
  id: number
  remplacantId: number
  phone: string
  status: string
  response: 'disponible' | 'pas_disponible' | null
  respondedAt: string | null
  createdAt: string
  remplacantFirstName: string | null
  remplacantLastName: string | null
}

const MOTIF_LABELS: Record<string, string> = {
  maladie: 'Maladie',
  conge: 'Congé',
  formation: 'Formation',
  autre: 'Autre',
}

const CRENEAU_LABELS: Record<string, string> = {
  matin: 'Matin',
  apres_midi: 'Après-midi',
  journee: 'Journée',
}

const TYPE_LABELS: Record<string, string> = {
  collaborateur: 'Collaborateur',
  remplacant: 'Remplaçant',
}

export default function AbsencesPage() {
  const router = useRouter()
  const [absences, setAbsences] = useState<AbsenceRow[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMotif, setFilterMotif] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Sort
  type SortKey = 'personLastName' | 'type' | 'dateDebut' | 'creneau' | 'motif' | 'urgency'
  const [sortKey, setSortKey] = useState<SortKey>('urgency')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningAbsence, setAssigningAbsence] = useState<AbsenceRow | null>(null)
  const [remplacantsList, setRemplacantsList] = useState<RemplacantOption[]>([])
  const [selectedRemplacantId, setSelectedRemplacantId] = useState('')
  const [selectedEcoleId, setSelectedEcoleId] = useState('')
  const [assigningLoading, setAssigningLoading] = useState(false)
  const [remplacantSearch, setRemplacantSearch] = useState('')

  // Search available modal
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchingAbsence, setSearchingAbsence] = useState<AbsenceRow | null>(null)
  const [availableRemplacants, setAvailableRemplacants] = useState<RemplacantOption[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [availableSearch, setAvailableSearch] = useState('')
  const [checkedRemplacants, setCheckedRemplacants] = useState<Set<number>>(new Set())

  // Message step in search modal
  const [showMessageStep, setShowMessageStep] = useState(false)
  const [selectedWhatsappEcoleId, setSelectedWhatsappEcoleId] = useState('')

  // Responses modal
  const [showResponsesModal, setShowResponsesModal] = useState(false)
  const [responsesAbsence, setResponsesAbsence] = useState<AbsenceRow | null>(null)
  const [responses, setResponses] = useState<WhatsappResponseRow[]>([])
  const [loadingResponses, setLoadingResponses] = useState(false)

  // Create absence modal
  const [showCreateModal, setShowCreateModal] = useState(false)
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const URGENCY_PRIORITY: Record<UrgencyLevel, number> = {
    urgent: 0,
    warning: 1,
    normal: 2,
    no_deadline: 3,
    replaced: 4,
  }

  const sortedAbsences = useMemo(() => {
    const sorted = [...absences].sort((a, b) => {
      if (sortKey === 'urgency') {
        const aPri = URGENCY_PRIORITY[a.urgency] * 1000 + (a.joursRestants ?? 999)
        const bPri = URGENCY_PRIORITY[b.urgency] * 1000 + (b.joursRestants ?? 999)
        if (aPri !== bPri) return sortDir === 'asc' ? aPri - bPri : bPri - aPri
        return b.dateDebut.localeCompare(a.dateDebut)
      }

      let aVal = ''
      let bVal = ''

      if (sortKey === 'personLastName') {
        aVal = (a.personLastName || '').toLowerCase()
        bVal = (b.personLastName || '').toLowerCase()
      } else if (sortKey === 'dateDebut') {
        aVal = a.dateDebut
        bVal = b.dateDebut
      } else {
        aVal = (a[sortKey] || '').toString().toLowerCase()
        bVal = (b[sortKey] || '').toString().toLowerCase()
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [absences, sortKey, sortDir])

  const fetchAbsences = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterType) params.set('type', filterType)
      if (filterMotif) params.set('motif', filterMotif)
      if (showAll) params.set('showAll', 'true')

      const res = await fetch(`/api/absences?${params.toString()}`)
      const data = await res.json()
      setAbsences(data.data || [])
    } catch (error) {
      console.error('Error fetching absences:', error)
    } finally {
      setLoading(false)
    }
  }, [search, filterType, filterMotif, showAll])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAbsences()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchAbsences])

  // Auto-refresh every 30s to pick up WhatsApp responses
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAbsences()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchAbsences])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const handleRowClick = (absence: AbsenceRow) => {
    router.push(`/absences/${absence.id}`)
  }

  // ─── Assignment modal handlers ──────────────────────────────

  const filteredRemplacants = useMemo(() => {
    if (!remplacantSearch.trim()) return remplacantsList
    const q = remplacantSearch.toLowerCase()
    return remplacantsList.filter(
      (r) => r.lastName.toLowerCase().includes(q) || r.firstName.toLowerCase().includes(q)
    )
  }, [remplacantsList, remplacantSearch])

  const selectedRemplacant = useMemo(() => {
    if (!selectedRemplacantId) return null
    return remplacantsList.find((r) => r.id.toString() === selectedRemplacantId) || null
  }, [remplacantsList, selectedRemplacantId])

  const openAssignModal = async (absence: AbsenceRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setAssigningAbsence(absence)
    setSelectedRemplacantId('')
    setRemplacantSearch('')
    setSelectedEcoleId(absence.collaborateurEcoles.length === 1 ? absence.collaborateurEcoles[0].id.toString() : '')
    setShowAssignModal(true)

    try {
      const res = await fetch('/api/remplacants?isActive=true')
      const data = await res.json()
      setRemplacantsList(
        (data.data || []).map((r: RemplacantOption) => ({
          id: r.id,
          lastName: r.lastName,
          firstName: r.firstName,
        }))
      )
    } catch (error) {
      console.error('Error fetching remplacants:', error)
    }
  }

  const handleAssignRemplacement = async () => {
    if (!assigningAbsence || !selectedRemplacantId || !selectedEcoleId) {
      alert('Veuillez sélectionner un remplaçant et une école')
      return
    }

    setAssigningLoading(true)
    try {
      const res = await fetch(`/api/remplacants/${selectedRemplacantId}/affectations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collaborateurId: assigningAbsence.collaborateurId,
          ecoleId: parseInt(selectedEcoleId),
          dateDebut: assigningAbsence.dateDebut,
          dateFin: assigningAbsence.dateFin,
          creneau: assigningAbsence.creneau,
          motif: MOTIF_LABELS[assigningAbsence.motif] || assigningAbsence.motif,
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        alert(error || 'Erreur lors de l\'affectation')
        return
      }

      setShowAssignModal(false)
      setAssigningAbsence(null)
      await fetchAbsences()
    } catch (error) {
      console.error('Error assigning remplacement:', error)
      alert('Erreur lors de l\'affectation')
    } finally {
      setAssigningLoading(false)
    }
  }

  // ─── Search available modal handlers ────────────────────────

  const filteredAvailable = useMemo(() => {
    if (!availableSearch.trim()) return availableRemplacants
    const q = availableSearch.toLowerCase()
    return availableRemplacants.filter(
      (r) => r.lastName.toLowerCase().includes(q) || r.firstName.toLowerCase().includes(q)
    )
  }, [availableRemplacants, availableSearch])

  const openSearchModal = async (absence: AbsenceRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setSearchingAbsence(absence)
    setAvailableSearch('')
    setCheckedRemplacants(new Set())
    setShowMessageStep(false)
    setShowSearchModal(true)
    setLoadingAvailable(true)

    try {
      const params = new URLSearchParams({
        isActive: 'true',
        availableFrom: absence.dateDebut,
        availableTo: absence.dateFin,
      })
      const res = await fetch(`/api/remplacants?${params.toString()}`)
      const data = await res.json()
      setAvailableRemplacants(
        (data.data || []).map((r: RemplacantOption) => ({
          id: r.id,
          lastName: r.lastName,
          firstName: r.firstName,
          phone: r.phone || null,
          email: r.email || null,
        }))
      )
    } catch (error) {
      console.error('Error fetching available remplacants:', error)
    } finally {
      setLoadingAvailable(false)
    }
  }

  const toggleChecked = (id: number) => {
    setCheckedRemplacants(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (checkedRemplacants.size === filteredAvailable.length) {
      setCheckedRemplacants(new Set())
    } else {
      setCheckedRemplacants(new Set(filteredAvailable.map(r => r.id)))
    }
  }

  const generateSchedulePreview = useCallback((absence: AbsenceRow, ecoleId: string): string[] => {
    const jourNamesByDow: Record<number, string> = {
      1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi',
    }
    const jourAbrev: Record<string, string> = {
      lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven',
    }

    const ecole = absence.collaborateurEcoles.find(e => e.id.toString() === ecoleId)
    let joursPresence: JourPresence[] = []
    if (ecole?.joursPresence) {
      try {
        joursPresence = JSON.parse(ecole.joursPresence)
      } catch { /* ignore */ }
    }

    // Build jour→creneau map
    const jourCreneauMap: Record<string, string> = {}
    if (joursPresence.length > 0) {
      for (const jp of joursPresence) {
        const existing = jourCreneauMap[jp.jour]
        if (existing) {
          if ((existing === 'matin' && jp.creneau === 'apres_midi') ||
              (existing === 'apres_midi' && jp.creneau === 'matin')) {
            jourCreneauMap[jp.jour] = 'journee'
          }
        } else {
          jourCreneauMap[jp.jour] = jp.creneau
        }
      }
    }

    const start = new Date(absence.dateDebut + 'T00:00:00')
    const end = new Date(absence.dateFin + 'T00:00:00')
    const lines: string[] = []
    const current = new Date(start)

    while (current <= end) {
      const dow = current.getDay()
      if (dow >= 1 && dow <= 5) {
        const jourName = jourNamesByDow[dow]
        let creneau: string | null = null
        if (joursPresence.length > 0) {
          creneau = jourCreneauMap[jourName] || null
        } else {
          creneau = absence.creneau
        }
        if (creneau) {
          const dateStr = current.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          const label = CRENEAU_LABELS[creneau] || creneau
          lines.push(`${jourAbrev[jourName]} ${dateStr}: ${label}`)
        }
      }
      current.setDate(current.getDate() + 1)
    }

    return lines
  }, [])

  const handleSendMessage = () => {
    if (!searchingAbsence) return
    setSendResults(null)
    // Auto-select école if only one
    if (searchingAbsence.collaborateurEcoles.length === 1) {
      setSelectedWhatsappEcoleId(searchingAbsence.collaborateurEcoles[0].id.toString())
    } else {
      setSelectedWhatsappEcoleId('')
    }
    setShowMessageStep(true)
  }

  // Send results
  const [sendResults, setSendResults] = useState<{ name: string; phone: string; success: boolean; error?: string }[] | null>(null)
  const [sendingMessages, setSendingMessages] = useState(false)

  const handleSendWhatsApp = async () => {
    if (!searchingAbsence) return

    const selected = availableRemplacants.filter(r => checkedRemplacants.has(r.id))
    const recipients = selected
      .filter(r => r.phone)
      .map(r => ({ phone: r.phone!, name: `${r.firstName} ${r.lastName}`, remplacantId: r.id }))

    if (recipients.length === 0) {
      alert('Aucun remplaçant sélectionné avec un numéro de téléphone')
      return
    }

    // Get collaborateur name and école info
    const collaborateurName = `${searchingAbsence.personFirstName || ''} ${searchingAbsence.personLastName || ''}`.trim()
    const selectedEcole = searchingAbsence.collaborateurEcoles.find(e => e.id.toString() === selectedWhatsappEcoleId)
    const ecoleName = selectedEcole?.name || ''

    // Parse joursPresence for the selected école
    let joursPresence: JourPresence[] | null = null
    if (selectedEcole?.joursPresence) {
      try {
        joursPresence = JSON.parse(selectedEcole.joursPresence)
      } catch { /* ignore */ }
    }

    setSendingMessages(true)
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          absenceId: searchingAbsence.id,
          dateDebut: searchingAbsence.dateDebut,
          dateFin: searchingAbsence.dateFin,
          creneau: CRENEAU_LABELS[searchingAbsence.creneau],
          collaborateurName,
          ecoleName,
          joursPresence,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Erreur lors de l\'envoi')
        return
      }

      setSendResults(data.data.results)
    } catch (error) {
      console.error('Error sending WhatsApp:', error)
      alert('Erreur lors de l\'envoi des messages')
    } finally {
      setSendingMessages(false)
    }
  }

  // ─── Responses modal handlers ──────────────────────────────

  const openResponsesModal = async (absence: AbsenceRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setResponsesAbsence(absence)
    setShowResponsesModal(true)
    setLoadingResponses(true)

    try {
      const res = await fetch(`/api/whatsapp/responses?absenceId=${absence.id}`)
      const data = await res.json()
      setResponses(data.data || [])
    } catch (error) {
      console.error('Error fetching responses:', error)
    } finally {
      setLoadingResponses(false)
    }
  }

  const handleDeleteResponse = async (messageId: number) => {
    if (!confirm('Supprimer cette réponse WhatsApp ?')) return

    try {
      const res = await fetch(`/api/whatsapp/responses/${messageId}`, { method: 'DELETE' })
      if (res.ok) {
        setResponses(prev => prev.filter(r => r.id !== messageId))
        // Refresh absences to update counts
        await fetchAbsences()
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error deleting response:', error)
    }
  }

  const handleDeleteAbsence = async (absence: AbsenceRow) => {
    if (!confirm('Supprimer cette absence ?')) return
    try {
      const endpoint = absence.type === 'collaborateur'
        ? `/api/collaborateurs/${absence.collaborateurId}/absences?absenceId=${absence.id}`
        : `/api/remplacants/${absence.remplacantId}/absences?absenceId=${absence.id}`
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (res.ok) {
        await fetchAbsences()
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error deleting absence:', error)
    }
  }

  // ─── Create absence modal handlers ────────────────────────

  const openCreateModal = () => {
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
    setShowCreateModal(true)
  }

  // Debounced person search
  useEffect(() => {
    if (!showCreateModal || createStep !== 1) return
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
  }, [showCreateModal, createStep, createPersonSearch, createPersonType])

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
      setShowCreateModal(false)
      await fetchAbsences()
      // Redirect to the new absence detail page
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

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <CalendarDaysIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Absences</h1>
              <p className="ds-header-subtitle">{absences.length} absence{absences.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn btn-primary"
          >
            <PlusIcon className="w-5 h-5 -ml-1" />
            Nouvelle absence
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="ds-table-container mb-4">
        <div className="p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="form-input w-auto"
          >
            <option value="">Tous les types</option>
            <option value="collaborateur">Collaborateur</option>
            <option value="remplacant">Remplaçant</option>
          </select>
          <select
            value={filterMotif}
            onChange={(e) => setFilterMotif(e.target.value)}
            className="form-input w-auto"
          >
            <option value="">Tous les motifs</option>
            <option value="maladie">Maladie</option>
            <option value="conge">Congé</option>
            <option value="formation">Formation</option>
            <option value="autre">Autre</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Inclure les passées
          </label>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="ds-empty-state">
          <div className="ds-empty-state-content">
            <div className="spinner-md mx-auto mb-4"></div>
            <p className="text-gray-500">Chargement...</p>
          </div>
        </div>
      ) : absences.length === 0 ? (
        <div className="ds-empty-state">
          <div className="ds-empty-state-content">
            <div className="ds-empty-state-icon-wrapper">
              <CalendarDaysIcon className="ds-empty-state-icon" />
            </div>
            <h3 className="ds-empty-state-title">Aucune absence</h3>
            <p className="ds-empty-state-text">Aucune absence trouvée pour les critères sélectionnés.</p>
          </div>
        </div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                <th className="ds-table-header-cell">Statut</th>
                {([
                  ['personLastName', 'Personne'],
                  ['motif', 'Motif'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="ds-table-header-cell cursor-pointer select-none hover:text-purple-700 transition-colors"
                    onClick={() => toggleSort(key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey === key ? (
                        sortDir === 'asc'
                          ? <ChevronUpIcon className="w-3.5 h-3.5" />
                          : <ChevronDownIcon className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="ds-table-header-cell">Durée</th>
                {([
                  ['dateDebut', 'Dates'],
                  ['urgency', 'Urgence'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="ds-table-header-cell cursor-pointer select-none hover:text-purple-700 transition-colors"
                    onClick={() => toggleSort(key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey === key ? (
                        sortDir === 'asc'
                          ? <ChevronUpIcon className="w-3.5 h-3.5" />
                          : <ChevronDownIcon className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="ds-table-header-cell">Remplaçant(s)</th>
                <th className="ds-table-header-cell">Réponses</th>
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {sortedAbsences.map((absence) => (
                <tr
                  key={absence.id}
                  className={`ds-table-row cursor-pointer transition-colors ${
                    absence.urgency === 'urgent' ? 'bg-red-50 hover:bg-red-100' :
                    absence.urgency === 'warning' ? 'bg-yellow-50 hover:bg-yellow-100' :
                    'hover:bg-purple-50'
                  }`}
                  onClick={() => handleRowClick(absence)}
                >
                  {/* Statut */}
                  <td className="ds-table-cell">
                    {absence.type === 'collaborateur' ? (
                      absence.replacementStatus === 'full' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Remplacée</span>
                      ) : absence.replacementStatus === 'partial' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Partielle</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Non remplacée</span>
                      )
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  {/* Personne */}
                  <td className="ds-table-cell">
                    <div className="font-medium text-gray-900">{absence.personLastName?.toUpperCase()} {absence.personFirstName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{TYPE_LABELS[absence.type]}</div>
                  </td>
                  {/* Motif */}
                  <td className="ds-table-cell text-gray-600">
                    {MOTIF_LABELS[absence.motif]}
                    {absence.motifDetails && (
                      <span className="text-gray-400 ml-1">— {absence.motifDetails}</span>
                    )}
                  </td>
                  {/* Durée */}
                  <td className="ds-table-cell text-gray-600">
                    {(() => {
                      const start = new Date(absence.dateDebut + 'T00:00:00')
                      const end = new Date(absence.dateFin + 'T00:00:00')
                      let jours = 0
                      const current = new Date(start)
                      while (current <= end) {
                        const dow = current.getDay()
                        if (dow >= 1 && dow <= 5) jours++
                        current.setDate(current.getDate() + 1)
                      }
                      const creneaux = absence.creneau === 'journee' ? jours * 2 : jours
                      return (
                        <div className="text-xs">
                          <div className="font-medium">{jours}j</div>
                          <div className="text-gray-400">{creneaux} crén.</div>
                        </div>
                      )
                    })()}
                  </td>
                  {/* Dates */}
                  <td className="ds-table-cell text-gray-600">
                    {formatDate(absence.dateDebut)}
                    {absence.dateDebut !== absence.dateFin && ` → ${formatDate(absence.dateFin)}`}
                  </td>
                  {/* Urgence */}
                  <td className="ds-table-cell">
                    {absence.type === 'collaborateur' ? (
                      absence.urgency === 'replaced' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aucune</span>
                      ) : absence.urgency === 'urgent' ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Urgent</span>
                          <div className="text-[10px] text-red-600 mt-0.5">{Math.abs(absence.joursRestants!)}j de retard</div>
                        </div>
                      ) : absence.urgency === 'warning' ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Bientôt</span>
                          <div className="text-[10px] text-amber-600 mt-0.5">{absence.joursRestants}j restant</div>
                        </div>
                      ) : absence.urgency === 'normal' ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Normal</span>
                          <div className="text-[10px] text-blue-600 mt-0.5">{absence.joursRestants}j restant</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">--</span>
                      )
                    ) : (
                      <span className="text-gray-400 text-sm">--</span>
                    )}
                  </td>
                  {/* Remplaçant(s) */}
                  <td className="ds-table-cell">
                    {absence.remplacants && absence.remplacants.length > 0 ? (
                      <div className="text-xs space-y-0.5">
                        {absence.remplacants.map((r) => (
                          <div key={r.id}>
                            <Link
                              href={`/remplacants/${r.id}`}
                              className="text-purple-600 hover:underline font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.prenom} {r.nom?.toUpperCase()}
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  {/* Réponses */}
                  <td className="ds-table-cell">
                    {absence.type === 'collaborateur' && absence.whatsappSent > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        {absence.whatsappDisponible.length > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">
                            {absence.whatsappDisponible.length} dispo
                          </span>
                        )}
                        {absence.whatsappEnAttente > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-medium">
                            {absence.whatsappEnAttente} attente
                          </span>
                        )}
                        {absence.whatsappPasDisponible > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                            {absence.whatsappPasDisponible} indispo
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => openResponsesModal(absence, e)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-purple-600 hover:bg-purple-50 font-medium transition-colors"
                        >
                          <ChatBubbleLeftRightIcon className="w-3 h-3" />
                          Voir
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Affectation Remplaçant */}
      {showAssignModal && assigningAbsence && (
        <div className="modal-overlay">
          <div className="modal-container max-w-lg">
            <div className="modal-header">
              <h3 className="text-lg font-semibold">Affecter un remplaçant</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="space-y-4">
                {/* Absence info */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-gray-900">
                    {assigningAbsence.personLastName?.toUpperCase()} {assigningAbsence.personFirstName}
                  </div>
                  <div className="text-gray-600 mt-1">
                    {formatDate(assigningAbsence.dateDebut)}
                    {assigningAbsence.dateDebut !== assigningAbsence.dateFin && ` → ${formatDate(assigningAbsence.dateFin)}`}
                    {' • '}{CRENEAU_LABELS[assigningAbsence.creneau]}
                    {' • '}{MOTIF_LABELS[assigningAbsence.motif]}
                  </div>
                </div>

                {/* Remplaçant search */}
                <div className="form-group">
                  <label className="form-label">Remplaçant *</label>
                  {selectedRemplacant ? (
                    <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-purple-800">
                        {selectedRemplacant.lastName.toUpperCase()} {selectedRemplacant.firstName}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSelectedRemplacantId(''); setRemplacantSearch('') }}
                        className="text-purple-400 hover:text-purple-600"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
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

                {/* École selection */}
                <div className="form-group">
                  <label className="form-label">École *</label>
                  {assigningAbsence.collaborateurEcoles.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucune école associée à ce collaborateur</p>
                  ) : (
                    <>
                      <select
                        value={selectedEcoleId}
                        onChange={(e) => setSelectedEcoleId(e.target.value)}
                        className="form-input"
                      >
                        {assigningAbsence.collaborateurEcoles.length > 1 && (
                          <option value="">-- Sélectionner une école --</option>
                        )}
                        {assigningAbsence.collaborateurEcoles.map((ecole) => (
                          <option key={ecole.id} value={ecole.id}>
                            {ecole.name}
                          </option>
                        ))}
                      </select>
                      {selectedEcoleId && (() => {
                        const ecole = assigningAbsence.collaborateurEcoles.find(e => e.id.toString() === selectedEcoleId)
                        if (!ecole || ecole.remplacementApresJours == null) return null
                        return (
                          <div className={`mt-2 text-xs px-2 py-1 rounded ${
                            ecole.urgency === 'urgent' ? 'bg-red-50 text-red-700' :
                            ecole.urgency === 'warning' ? 'bg-amber-50 text-amber-700' :
                            ecole.urgency === 'normal' ? 'bg-blue-50 text-blue-700' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            Délai de remplacement : {ecole.remplacementApresJours} jour{ecole.remplacementApresJours > 1 ? 's' : ''}
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
                  onClick={() => setShowAssignModal(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAssignRemplacement}
                  disabled={assigningLoading || !selectedRemplacantId || !selectedEcoleId}
                  className="btn btn-primary"
                >
                  {assigningLoading ? 'Affectation...' : 'Affecter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Réponses WhatsApp */}
      {showResponsesModal && responsesAbsence && (
        <div className="modal-overlay">
          <div className="modal-container max-w-2xl">
            <div className="modal-header">
              <h3 className="text-lg font-semibold">Réponses WhatsApp</h3>
              <button onClick={() => setShowResponsesModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="space-y-4">
                {/* Absence info */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-gray-900">
                    {responsesAbsence.personLastName?.toUpperCase()} {responsesAbsence.personFirstName}
                  </div>
                  <div className="text-gray-600 mt-1">
                    {formatDate(responsesAbsence.dateDebut)}
                    {responsesAbsence.dateDebut !== responsesAbsence.dateFin && ` → ${formatDate(responsesAbsence.dateFin)}`}
                    {' • '}{CRENEAU_LABELS[responsesAbsence.creneau]}
                    {' • '}{MOTIF_LABELS[responsesAbsence.motif]}
                  </div>
                </div>

                {/* Responses list */}
                {loadingResponses ? (
                  <div className="flex items-center justify-center p-6">
                    <span className="inline-block w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
                    <span className="text-sm text-gray-500">Chargement...</span>
                  </div>
                ) : responses.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">Aucun message WhatsApp envoyé pour cette absence.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                      {responses.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0"
                        >
                          {/* Status indicator */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            r.response === 'disponible' ? 'bg-green-500' :
                            r.response === 'pas_disponible' ? 'bg-red-500' :
                            'bg-yellow-400'
                          }`} />

                          {/* Name + phone */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">
                              <Link
                                href={`/remplacants/${r.remplacantId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium text-gray-900 hover:text-purple-600"
                              >
                                {r.remplacantLastName?.toUpperCase()} {r.remplacantFirstName}
                              </Link>
                            </div>
                            <div className="text-xs text-gray-400">
                              {r.phone} • Envoyé {formatDateTime(r.createdAt)}
                            </div>
                          </div>

                          {/* Response badge */}
                          <div className="flex-shrink-0">
                            {r.response === 'disponible' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Disponible
                              </span>
                            ) : r.response === 'pas_disponible' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                Indisponible
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                En attente
                              </span>
                            )}
                          </div>

                          {/* Responded at */}
                          {r.respondedAt && (
                            <div className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                              {formatDateTime(r.respondedAt)}
                            </div>
                          )}

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteResponse(r.id)}
                            className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <div></div>
              <div className="modal-footer-actions">
                <button
                  type="button"
                  onClick={() => setShowResponsesModal(false)}
                  className="btn btn-secondary"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Création absence */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-lg overflow-visible">
            <div className="modal-header">
              <h3 className="text-lg font-semibold">
                {createStep === 1 ? 'Nouvelle absence — Sélection personne' : 'Nouvelle absence — Détails'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body overflow-visible">
              {createStep === 1 ? (
                <div className="space-y-4">
                  {/* Type toggle */}
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

                  {/* Search input */}
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

                  {/* Results */}
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
                  {/* Selected person */}
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

                  {/* Date range */}
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

                  {/* Créneau */}
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

                  {/* Motif */}
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

                  {/* Détails */}
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
                  onClick={() => setShowCreateModal(false)}
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
      )}

      {/* Modal Recherche de remplaçant */}
      {showSearchModal && searchingAbsence && (
        <div className="modal-overlay">
          <div className="modal-container max-w-2xl">
            <div className="modal-header">
              <h3 className="text-lg font-semibold">Recherche de remplaçant</h3>
              <button onClick={() => setShowSearchModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              {!showMessageStep ? (
                <div className="space-y-4">
                  {/* Absence info */}
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="font-medium text-gray-900">
                      {searchingAbsence.personLastName?.toUpperCase()} {searchingAbsence.personFirstName}
                    </div>
                    <div className="text-gray-600 mt-1">
                      {formatDate(searchingAbsence.dateDebut)}
                      {searchingAbsence.dateDebut !== searchingAbsence.dateFin && ` → ${formatDate(searchingAbsence.dateFin)}`}
                      {' • '}{CRENEAU_LABELS[searchingAbsence.creneau]}
                      {' • '}{MOTIF_LABELS[searchingAbsence.motif]}
                    </div>
                  </div>

                  {/* Search + count */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filtrer par nom..."
                        value={availableSearch}
                        onChange={(e) => setAvailableSearch(e.target.value)}
                        className="form-input pl-9"
                      />
                    </div>
                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {loadingAvailable ? '...' : `${availableRemplacants.length} disponible(s)`}
                    </span>
                  </div>

                  {/* List with checkboxes */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Select all header */}
                    {!loadingAvailable && filteredAvailable.length > 0 && (
                      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <input
                          type="checkbox"
                          checked={checkedRemplacants.size === filteredAvailable.length && filteredAvailable.length > 0}
                          onChange={toggleAll}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          Tout sélectionner ({checkedRemplacants.size}/{filteredAvailable.length})
                        </span>
                      </div>
                    )}

                    <div className="max-h-72 overflow-y-auto">
                      {loadingAvailable ? (
                        <div className="flex items-center justify-center p-6">
                          <span className="inline-block w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
                          <span className="text-sm text-gray-500">Recherche des remplaçants disponibles...</span>
                        </div>
                      ) : filteredAvailable.length === 0 ? (
                        <p className="text-sm text-gray-500 p-6 text-center">
                          Aucun remplaçant disponible sur cette période
                        </p>
                      ) : (
                        filteredAvailable.map((r) => (
                          <label
                            key={r.id}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checkedRemplacants.has(r.id)}
                              onChange={() => toggleChecked(r.id)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">
                                <span className="font-medium text-gray-900">{r.lastName.toUpperCase()}</span>{' '}
                                <span className="text-gray-600">{r.firstName}</span>
                              </div>
                              {(r.phone || r.email) && (
                                <div className="text-xs text-gray-400 mt-0.5 truncate">
                                  {[r.phone, r.email].filter(Boolean).join(' • ')}
                                </div>
                              )}
                            </div>
                            <Link
                              href={`/remplacants/${r.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-purple-600 hover:underline whitespace-nowrap"
                            >
                              Voir fiche
                            </Link>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {!sendResults ? (
                    <>
                      {/* École selector if multiple */}
                      {searchingAbsence && searchingAbsence.collaborateurEcoles.length > 1 && (
                        <div className="form-group">
                          <label className="form-label">École concernée *</label>
                          <select
                            value={selectedWhatsappEcoleId}
                            onChange={(e) => setSelectedWhatsappEcoleId(e.target.value)}
                            className="form-input"
                          >
                            <option value="">-- Sélectionner une école --</option>
                            {searchingAbsence.collaborateurEcoles.map((ecole) => (
                              <option key={ecole.id} value={ecole.id}>
                                {ecole.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Template preview */}
                      {searchingAbsence && (
                        <div>
                          <label className="form-label">Message WhatsApp</label>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-800">
                            <p>
                              Bonjour, nous recherchons un remplaçant pour{' '}
                              <strong>{searchingAbsence.personFirstName} {searchingAbsence.personLastName}</strong>
                              {selectedWhatsappEcoleId && (
                                <> à l&apos;école <strong>{searchingAbsence.collaborateurEcoles.find(e => e.id.toString() === selectedWhatsappEcoleId)?.name}</strong></>
                              )}.
                            </p>
                            {selectedWhatsappEcoleId && (
                              <div className="mt-2">
                                <span className="font-medium">Horaires :</span>
                                <div className="mt-1 space-y-0.5 font-mono text-xs">
                                  {generateSchedulePreview(searchingAbsence, selectedWhatsappEcoleId).map((line, i) => (
                                    <div key={i}>{line}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {!selectedWhatsappEcoleId && searchingAbsence.collaborateurEcoles.length === 0 && (
                              <p className="mt-1">
                                Du <strong>{formatDate(searchingAbsence.dateDebut)}</strong> au{' '}
                                <strong>{formatDate(searchingAbsence.dateFin)}</strong>{' '}
                                (<strong>{CRENEAU_LABELS[searchingAbsence.creneau]}</strong>).
                              </p>
                            )}
                            <p className="mt-2">Êtes-vous disponible ?</p>
                            <div className="flex gap-2 mt-3">
                              <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-green-300 text-sm font-medium text-green-800 bg-white">
                                Oui
                              </span>
                              <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-green-300 text-sm font-medium text-green-800 bg-white">
                                Non
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Le remplaçant recevra ce message avec des boutons de réponse rapide.
                          </p>
                        </div>
                      )}

                      {/* List of selected remplaçants */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          {availableRemplacants.filter(r => checkedRemplacants.has(r.id)).length} remplaçant(s) sélectionné(s)
                        </h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          {availableRemplacants
                            .filter(r => checkedRemplacants.has(r.id))
                            .map((r) => (
                              <div
                                key={r.id}
                                className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="text-sm">
                                  <span className="font-medium text-gray-900">{r.lastName.toUpperCase()}</span>{' '}
                                  <span className="text-gray-600">{r.firstName}</span>
                                </div>
                                {r.phone ? (
                                  <span className="text-xs text-gray-400">{r.phone}</span>
                                ) : (
                                  <span className="text-xs text-red-400 italic">Pas de téléphone</span>
                                )}
                              </div>
                            ))}
                        </div>
                        {availableRemplacants.filter(r => checkedRemplacants.has(r.id) && !r.phone).length > 0 && (
                          <p className="text-xs text-red-500 mt-1">
                            Les remplaçants sans téléphone ne recevront pas de message.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Send results */
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-gray-700">Résultats de l&apos;envoi</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {sendResults.filter(r => r.success).length} envoyé(s)
                        </span>
                        {sendResults.filter(r => !r.success).length > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {sendResults.filter(r => !r.success).length} échoué(s)
                          </span>
                        )}
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        {sendResults.map((r, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">{r.name}</span>
                              <span className="text-xs text-gray-400 ml-2">{r.phone}</span>
                            </div>
                            {r.success ? (
                              <span className="status-badge-success">Envoyé</span>
                            ) : (
                              <span className="text-xs text-red-600" title={r.error}>{r.error || 'Erreur'}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <div></div>
              <div className="modal-footer-actions">
                {showMessageStep ? (
                  <>
                    {!sendResults && (
                      <button
                        type="button"
                        onClick={() => setShowMessageStep(false)}
                        className="btn btn-secondary"
                        disabled={sendingMessages}
                      >
                        Retour
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowSearchModal(false)}
                      className="btn btn-secondary"
                    >
                      Fermer
                    </button>
                    {!sendResults && (
                      <button
                        type="button"
                        onClick={handleSendWhatsApp}
                        disabled={sendingMessages || (searchingAbsence?.collaborateurEcoles && searchingAbsence.collaborateurEcoles.length > 0 && !selectedWhatsappEcoleId)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingMessages ? (
                          <>
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Envoi en cours...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            Envoyer via WhatsApp
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowSearchModal(false)}
                      className="btn btn-secondary"
                    >
                      Fermer
                    </button>
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={checkedRemplacants.size === 0}
                      className="btn btn-primary"
                    >
                      Envoyer un message ({checkedRemplacants.size})
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
