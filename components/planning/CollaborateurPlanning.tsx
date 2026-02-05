'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import WeekNavigation from './WeekNavigation'
import {
  Creneau,
  CRENEAU_LABELS,
  getWeekDates,
  formatDate,
  JourSemaine,
  JOUR_LABELS,
} from './types'

// Types for presence data
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

interface Remplacement {
  id: number
  remplacantId: number
  remplacantNom: string | null
  remplacantPrenom: string | null
  ecoleId: number
  ecoleName: string | null
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string | null
}

interface CollaborateurPlanningProps {
  collaborateurId: string | number
}

export default function CollaborateurPlanning({ collaborateurId }: CollaborateurPlanningProps) {
  const [presences, setPresences] = useState<Presence[]>([])
  const [remplacements, setRemplacements] = useState<Remplacement[]>([])
  const [loading, setLoading] = useState(true)

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(monday.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const startDateStr = formatDate(weekDates[0])
  const endDateStr = formatDate(weekDates[weekDates.length - 1])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/collaborateurs/${collaborateurId}/planning?startDate=${startDateStr}&endDate=${endDateStr}`
      )
      if (res.ok) {
        const { data } = await res.json()
        setPresences(data?.presences || [])
        setRemplacements(data?.remplacements || [])
      }
    } catch (error) {
      console.error('Error fetching planning:', error)
    } finally {
      setLoading(false)
    }
  }, [collaborateurId, startDateStr, endDateStr])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const goToPreviousWeek = useCallback(() => {
    setWeekStart((prev) => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() - 7)
      return newDate
    })
  }, [])

  const goToNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + 7)
      return newDate
    })
  }, [])

  const goToToday = useCallback(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(monday.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    setWeekStart(monday)
  }, [])

  // Build a map of day+creneau to presence info
  const presenceMap = useMemo(() => {
    const map = new Map<string, { ecoleId: number; ecoleName: string }[]>()

    for (const presence of presences) {
      for (const jp of presence.joursPresence) {
        const key = `${jp.jour}:${jp.creneau}`
        const existing = map.get(key) || []
        if (!existing.some((e) => e.ecoleId === presence.ecoleId)) {
          existing.push({ ecoleId: presence.ecoleId, ecoleName: presence.ecoleName })
        }
        map.set(key, existing)
      }
    }

    return map
  }, [presences])

  // Get remplacement for a specific date and créneau
  const getRemplacementForCell = (date: Date, creneau: Creneau): Remplacement | undefined => {
    const dateStr = formatDate(date)
    return remplacements.find((r) => {
      const isInRange = dateStr >= r.dateDebut && dateStr <= r.dateFin
      const creneauMatch =
        r.creneau === creneau || r.creneau === 'journee' || creneau === 'journee'
      return isInRange && creneauMatch
    })
  }

  // Get presence for a specific day and créneau
  const getPresenceForCell = (
    jour: JourSemaine,
    creneau: Creneau
  ): { ecoleId: number; ecoleName: string }[] => {
    // Check for journee match first
    const journeeKey = `${jour}:journee`
    const journeePresence = presenceMap.get(journeeKey)
    if (journeePresence) return journeePresence

    // Then check specific creneau
    const key = `${jour}:${creneau}`
    return presenceMap.get(key) || []
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="spinner-md mx-auto mb-4"></div>
        <p className="text-gray-500">Chargement du planning...</p>
      </div>
    )
  }

  const joursMapping: { jour: JourSemaine; index: number }[] = [
    { jour: 'lundi', index: 0 },
    { jour: 'mardi', index: 1 },
    { jour: 'mercredi', index: 2 },
    { jour: 'jeudi', index: 3 },
    { jour: 'vendredi', index: 4 },
  ]

  return (
    <div>
      <WeekNavigation
        weekStart={weekStart}
        onPrevious={goToPreviousWeek}
        onNext={goToNextWeek}
        onToday={goToToday}
      />

      {/* Week calendar grid */}
      <div className="overflow-x-auto mt-4">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="w-24 p-2 text-left text-xs font-medium text-gray-500 uppercase"></th>
              {weekDates.map((date, i) => {
                const dateStr = formatDate(date)
                const isToday = formatDate(new Date()) === dateStr

                return (
                  <th
                    key={dateStr}
                    className={`p-2 text-center text-xs font-medium uppercase ${
                      isToday ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className="text-gray-500">{JOUR_LABELS[joursMapping[i].jour]}</div>
                    <div
                      className={`text-sm ${
                        isToday ? 'text-purple-700 font-bold' : 'text-gray-700'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {(['matin', 'apres_midi'] as Creneau[]).map((creneau) => (
              <tr key={creneau}>
                <td className="p-2 text-xs font-medium text-gray-600">
                  {CRENEAU_LABELS[creneau]}
                </td>
                {joursMapping.map(({ jour, index }) => {
                  const date = weekDates[index]
                  const remplacement = getRemplacementForCell(date, creneau)
                  const presencesList = getPresenceForCell(jour, creneau)
                  const hasPresence = presencesList.length > 0

                  return (
                    <td key={`${formatDate(date)}-${creneau}`} className="p-1">
                      <div
                        className={`
                          p-2 rounded border text-center text-sm min-h-[60px] flex flex-col items-center justify-center
                          ${
                            remplacement
                              ? 'bg-purple-100 border-purple-300 text-purple-700'
                              : hasPresence
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-gray-50 border-gray-200 text-gray-400'
                          }
                        `}
                      >
                        {remplacement ? (
                          <>
                            <Link
                              href={`/remplacants/${remplacement.remplacantId}`}
                              className="font-medium hover:underline text-purple-700"
                            >
                              {remplacement.remplacantPrenom}{' '}
                              {remplacement.remplacantNom}
                            </Link>
                            <span className="text-xs text-purple-500">
                              (remplacé)
                            </span>
                          </>
                        ) : hasPresence ? (
                          <>
                            {presencesList.map((p) => (
                              <Link
                                key={p.ecoleId}
                                href={`/ecoles/${p.ecoleId}`}
                                className="text-xs hover:underline"
                              >
                                {p.ecoleName}
                              </Link>
                            ))}
                          </>
                        ) : (
                          <span className="text-xs">-</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
          <span className="text-gray-600">Présence</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div>
          <span className="text-gray-600">Remplacé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
          <span className="text-gray-600">Non présent</span>
        </div>
      </div>

      {/* Presences by school */}
      {presences.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">
            Présences par école ({presences.length})
          </h3>
          <div className="space-y-2">
            {presences.map((p) => (
              <div key={p.ecoleId} className="bg-green-50 rounded-lg px-3 py-2 text-sm">
                <div className="font-medium text-green-800">
                  <Link href={`/ecoles/${p.ecoleId}`} className="hover:underline">
                    {p.ecoleName}
                  </Link>
                </div>
                <div className="text-green-600 text-xs">
                  {p.joursPresence.length > 0
                    ? p.joursPresence
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
            ))}
          </div>
        </div>
      )}

      {/* Remplacements this week */}
      {remplacements.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">
            Remplacements cette semaine ({remplacements.length})
          </h3>
          <div className="space-y-2">
            {remplacements.map((r) => (
              <div key={r.id} className="bg-purple-50 rounded-lg px-3 py-2 text-sm">
                <div className="font-medium text-purple-800">
                  {new Date(r.dateDebut).toLocaleDateString('fr-FR')}
                  {r.dateDebut !== r.dateFin &&
                    ` - ${new Date(r.dateFin).toLocaleDateString('fr-FR')}`}
                  {' • '}
                  {CRENEAU_LABELS[r.creneau]}
                </div>
                <div className="text-purple-600">
                  Remplacé par{' '}
                  <Link
                    href={`/remplacants/${r.remplacantId}`}
                    className="hover:underline"
                  >
                    {r.remplacantPrenom} {r.remplacantNom}
                  </Link>
                  {r.ecoleName && ` (${r.ecoleName})`}
                </div>
                {r.motif && (
                  <div className="text-xs text-gray-500 mt-1">Motif: {r.motif}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {presences.length === 0 && remplacements.length === 0 && (
        <div className="mt-6 text-center py-8 text-gray-500">
          Aucune présence ni remplacement enregistré pour ce collaborateur.
        </div>
      )}
    </div>
  )
}
