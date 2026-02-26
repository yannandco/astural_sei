'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDaysIcon, ChevronDownIcon, MagnifyingGlassIcon, ClockIcon } from '@heroicons/react/24/outline'
import { CRENEAU_LABELS, MOTIF_LABELS } from '@/components/planning'
import type { Creneau } from '@/components/planning'

interface PortailRemplacement {
  id: number
  collaborateurId?: number
  collaborateurNom?: string | null
  collaborateurPrenom?: string | null
  ecoleId: number
  ecoleNom: string | null
  directeurNom?: string | null
  directeurPrenom?: string | null
  directeurEmail?: string | null
  directeurPhone?: string | null
  titulairesNoms?: string | null
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string | null
}

interface GroupedRemplacement {
  key: string
  collaborateurId: number | undefined
  collaborateurNom: string
  ecoleNom: string
  motif: string | null
  dateDebutGlobal: string
  dateFinGlobal: string
  directeurNom?: string | null
  directeurPrenom?: string | null
  directeurEmail?: string | null
  directeurPhone?: string | null
  titulairesNoms?: string | null
  entries: PortailRemplacement[]
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateRange(debut: string, fin: string): string {
  if (debut === fin) return formatDisplayDate(debut)
  return `${formatDisplayDate(debut)} — ${formatDisplayDate(fin)}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function groupAffectations(affectations: PortailRemplacement[]): GroupedRemplacement[] {
  const sorted = [...affectations].sort((a, b) => {
    const collA = `${a.collaborateurNom} ${a.collaborateurPrenom}`
    const collB = `${b.collaborateurNom} ${b.collaborateurPrenom}`
    if (collA !== collB) return collA.localeCompare(collB)
    if ((a.ecoleNom || '') !== (b.ecoleNom || '')) return (a.ecoleNom || '').localeCompare(b.ecoleNom || '')
    return a.dateDebut.localeCompare(b.dateDebut)
  })

  const groups: GroupedRemplacement[] = []

  for (const aff of sorted) {
    const lastGroup = groups[groups.length - 1]
    const belongsToGroup = lastGroup
      && lastGroup.collaborateurId === aff.collaborateurId
      && lastGroup.ecoleNom === aff.ecoleNom
      && lastGroup.motif === aff.motif
      && aff.dateDebut <= addDays(lastGroup.dateFinGlobal, 3)

    if (belongsToGroup) {
      lastGroup.entries.push(aff)
      if (aff.dateFin > lastGroup.dateFinGlobal) lastGroup.dateFinGlobal = aff.dateFin
      if (aff.dateDebut < lastGroup.dateDebutGlobal) lastGroup.dateDebutGlobal = aff.dateDebut
    } else {
      groups.push({
        key: `${aff.collaborateurId}-${aff.ecoleId}-${aff.dateDebut}-${groups.length}`,
        collaborateurId: aff.collaborateurId,
        collaborateurNom: `${aff.collaborateurPrenom} ${aff.collaborateurNom}`,
        ecoleNom: aff.ecoleNom || '',
        motif: aff.motif,
        dateDebutGlobal: aff.dateDebut,
        dateFinGlobal: aff.dateFin,
        directeurNom: aff.directeurNom,
        directeurPrenom: aff.directeurPrenom,
        directeurEmail: aff.directeurEmail,
        directeurPhone: aff.directeurPhone,
        titulairesNoms: aff.titulairesNoms,
        entries: [aff],
      })
    }
  }

  groups.sort((a, b) => a.dateDebutGlobal.localeCompare(b.dateDebutGlobal))
  return groups
}

export default function RemplacementsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [futureAffectations, setFutureAffectations] = useState<PortailRemplacement[]>([])
  const [pastAffectations, setPastAffectations] = useState<PortailRemplacement[]>([])
  const [showPast, setShowPast] = useState(false)
  const [expandedPast, setExpandedPast] = useState<Record<string, boolean>>({})
  const [searchPast, setSearchPast] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const meRes = await fetch('/api/portail/me')
      if (!meRes.ok) { router.push('/login'); return }
      const meJson = await meRes.json()
      if (meJson.data.role !== 'remplacant') { router.push('/portail'); return }

      const [futureRes, pastRes] = await Promise.all([
        fetch('/api/portail/affectations?period=future'),
        fetch('/api/portail/affectations?period=past'),
      ])
      const futureData = await futureRes.json()
      const pastData = await pastRes.json()
      setFutureAffectations(futureData.data || [])
      setPastAffectations(pastData.data || [])
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const futureGroups = useMemo(() => groupAffectations(futureAffectations), [futureAffectations])
  const pastGroups = useMemo(() => groupAffectations(pastAffectations), [pastAffectations])

  const filteredPastGroups = useMemo(() => {
    if (!searchPast.trim()) return pastGroups
    const q = searchPast.toLowerCase().trim()
    return pastGroups.filter(g =>
      g.collaborateurNom.toLowerCase().includes(q)
      || g.ecoleNom.toLowerCase().includes(q)
      || (g.motif && (MOTIF_LABELS[g.motif] || g.motif).toLowerCase().includes(q))
      || formatDateRange(g.dateDebutGlobal, g.dateFinGlobal).includes(q)
    )
  }, [pastGroups, searchPast])

  const togglePastGroup = (key: string) => {
    setExpandedPast(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mes remplacements</h1>
        <p className="text-gray-500 mt-1">Vos remplacements à venir et passés</p>
      </div>

      {/* Remplacements à venir */}
      <div className="ds-table-container">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Remplacements à venir
          </h2>
          {futureGroups.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun remplacement à venir.</p>
          ) : (
            <div className="space-y-4">
              {futureGroups.map((group) => (
                <div key={group.key} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{group.collaborateurNom}</p>
                      <p className="text-sm text-gray-600">{group.ecoleNom}</p>
                    </div>
                    {group.motif && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {MOTIF_LABELS[group.motif] || group.motif}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {group.entries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 text-sm">
                        <CalendarDaysIcon className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                        <span className="text-gray-700">{formatDateRange(entry.dateDebut, entry.dateFin)}</span>
                        <span className="text-xs text-gray-400">{CRENEAU_LABELS[entry.creneau] || entry.creneau}</span>
                      </div>
                    ))}
                  </div>

                  {(group.directeurNom || group.titulairesNoms) && (
                    <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-200">
                      {group.directeurNom && (
                        <p>
                          Directeur : {group.directeurPrenom} {group.directeurNom}
                          {group.directeurEmail && ` — ${group.directeurEmail}`}
                          {group.directeurPhone && ` — ${group.directeurPhone}`}
                        </p>
                      )}
                      {group.titulairesNoms && (
                        <p>Titulaires : {group.titulairesNoms}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Remplacements passés */}
      <div className="ds-table-container">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-2">
              <ClockIcon className="w-4 h-4" />
              Remplacements passés
              <span className="text-xs font-normal text-gray-400">({pastGroups.length})</span>
            </h2>
            <button
              onClick={() => setShowPast(!showPast)}
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`} />
              {showPast ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showPast ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {/* Search */}
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchPast}
                onChange={(e) => setSearchPast(e.target.value)}
                placeholder="Rechercher par nom, école, motif..."
                className="form-input pl-9 text-sm"
              />
            </div>

            {filteredPastGroups.length === 0 ? (
              <p className="text-sm text-gray-500">
                {searchPast.trim() ? 'Aucun résultat.' : 'Aucun remplacement passé.'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredPastGroups.map((group) => {
                  const isExpanded = expandedPast[group.key] || false
                  return (
                    <div key={group.key} className="bg-gray-50 rounded-lg overflow-hidden">
                      {/* Collapsed header — always visible */}
                      <button
                        onClick={() => togglePastGroup(group.key)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ClockIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{group.collaborateurNom}</p>
                            <p className="text-xs text-gray-400">
                              {group.ecoleNom} — {formatDateRange(group.dateDebutGlobal, group.dateFinGlobal)}
                              {group.entries.length > 1 && ` (${group.entries.length} créneaux)`}
                            </p>
                          </div>
                        </div>
                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Expanded details */}
                      <div className={`transition-all duration-200 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-gray-200">
                          {group.motif && (
                            <p className="text-xs text-gray-500 pt-2">
                              Motif : {MOTIF_LABELS[group.motif] || group.motif}
                            </p>
                          )}
                          <div className="space-y-0.5">
                            {group.entries.map((entry) => (
                              <div key={entry.id} className="flex items-center gap-2 text-sm">
                                <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-500">{formatDateRange(entry.dateDebut, entry.dateFin)}</span>
                                <span className="text-xs text-gray-400">{CRENEAU_LABELS[entry.creneau] || entry.creneau}</span>
                              </div>
                            ))}
                          </div>
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
  )
}
