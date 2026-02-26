'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDaysIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon, ChatBubbleLeftRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import WhatsAppResponsesModal from '@/components/modals/WhatsAppResponsesModal'
import CreateAbsenceModal from '@/components/modals/CreateAbsenceModal'

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

const MOTIF_LABELS: Record<string, string> = {
  maladie: 'Maladie',
  conge: 'Congé',
  formation: 'Formation',
  autre: 'Autre',
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

  // Responses modal
  const [showResponsesModal, setShowResponsesModal] = useState(false)
  const [responsesAbsence, setResponsesAbsence] = useState<AbsenceRow | null>(null)

  // Create absence modal
  const [showCreateModal, setShowCreateModal] = useState(false)

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

  // ─── Responses modal handlers ──────────────────────────────

  const openResponsesModal = (absence: AbsenceRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setResponsesAbsence(absence)
    setShowResponsesModal(true)
  }

  const openCreateModal = () => {
    setShowCreateModal(true)
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

      <WhatsAppResponsesModal
        isOpen={showResponsesModal && !!responsesAbsence}
        onClose={() => setShowResponsesModal(false)}
        absenceId={responsesAbsence?.id ?? 0}
        personFirstName={responsesAbsence?.personFirstName ?? null}
        personLastName={responsesAbsence?.personLastName ?? null}
        dateDebut={responsesAbsence?.dateDebut ?? ''}
        dateFin={responsesAbsence?.dateFin ?? ''}
        creneau={responsesAbsence?.creneau ?? ''}
        motif={responsesAbsence?.motif ?? ''}
        onResponseDeleted={fetchAbsences}
      />

      <CreateAbsenceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchAbsences}
      />

    </div>
  )
}
