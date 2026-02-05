'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import {
  Creneau,
  JourSemaine,
  JOUR_LABELS,
  JOURS_CALENDRIER,
  formatDate,
  getJourSemaine,
} from './types'

interface JourPresence {
  jour: JourSemaine
  creneau: Creneau
}

interface Collaborateur {
  id: number
  collaborateurId: number
  lastName: string
  firstName: string
  joursPresence: string | null
  isActive: boolean
}

interface Remplacement {
  id: number
  remplacantId: number
  remplacantNom: string | null
  remplacantPrenom: string | null
  collaborateurId: number
  collaborateurNom: string | null
  collaborateurPrenom: string | null
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string | null
}

interface EcoleMonthCalendarProps {
  ecoleId: number
}

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

// Helper pour obtenir le numéro de semaine
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export default function EcoleMonthCalendar({ ecoleId }: EcoleMonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([])
  const [remplacements, setRemplacements] = useState<Remplacement[]>([])
  const [loading, setLoading] = useState(true)

  // Obtenir tous les jours ouvrés du mois (Lu-Ve)
  const monthWorkDays = useMemo(() => {
    const days: Date[] = []
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const lastDay = new Date(year, month + 1, 0).getDate()

    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month, d)
      const dayOfWeek = date.getDay()
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push(date)
      }
    }
    return days
  }, [currentMonth])

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const startDate = formatDate(monthWorkDays[0] || currentMonth)
        const endDate = formatDate(monthWorkDays[monthWorkDays.length - 1] || currentMonth)

        const res = await fetch(`/api/ecoles/${ecoleId}/planning?startDate=${startDate}&endDate=${endDate}`)
        if (res.ok) {
          const { data } = await res.json()
          setCollaborateurs(data.collaborateurs || [])
          setRemplacements(data.remplacements || [])
        }
      } catch (error) {
        console.error('Error fetching planning:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [ecoleId, currentMonth, monthWorkDays])

  // Grouper par semaine
  const weeks = useMemo(() => {
    const result: Date[][] = []
    let currentWeek: Date[] = []
    let lastWeekNum = -1

    monthWorkDays.forEach(date => {
      const weekNum = getWeekNumber(date)
      if (weekNum !== lastWeekNum && currentWeek.length > 0) {
        result.push(currentWeek)
        currentWeek = []
      }
      currentWeek.push(date)
      lastWeekNum = weekNum
    })

    if (currentWeek.length > 0) {
      result.push(currentWeek)
    }

    return result
  }, [monthWorkDays])

  // Build presence map: jour+creneau -> collaborateurs présents
  const presenceMap = useMemo(() => {
    const map = new Map<string, { collaborateurId: number; name: string }[]>()

    for (const collab of collaborateurs) {
      if (!collab.joursPresence) continue
      try {
        const jours: JourPresence[] = JSON.parse(collab.joursPresence)
        for (const jp of jours) {
          const key = `${jp.jour}:${jp.creneau}`
          const existing = map.get(key) || []
          const name = `${collab.firstName} ${collab.lastName?.toUpperCase()}`
          if (!existing.some(e => e.collaborateurId === collab.collaborateurId)) {
            existing.push({ collaborateurId: collab.collaborateurId, name })
          }
          map.set(key, existing)

          // Si journee, ajouter aussi aux créneaux matin et apres_midi
          if (jp.creneau === 'journee') {
            const keyMatin = `${jp.jour}:matin`
            const keyAM = `${jp.jour}:apres_midi`
            const existingMatin = map.get(keyMatin) || []
            const existingAM = map.get(keyAM) || []
            if (!existingMatin.some(e => e.collaborateurId === collab.collaborateurId)) {
              existingMatin.push({ collaborateurId: collab.collaborateurId, name })
            }
            if (!existingAM.some(e => e.collaborateurId === collab.collaborateurId)) {
              existingAM.push({ collaborateurId: collab.collaborateurId, name })
            }
            map.set(keyMatin, existingMatin)
            map.set(keyAM, existingAM)
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return map
  }, [collaborateurs])

  const creneaux: Creneau[] = ['matin', 'apres_midi']

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  const goToCurrentMonth = useCallback(() => {
    const today = new Date()
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }, [])

  // Get remplacement for a specific date and créneau
  const getRemplacementForCell = (dateStr: string, creneau: Creneau): Remplacement | undefined => {
    return remplacements.find(r => {
      const isInRange = dateStr >= r.dateDebut && dateStr <= r.dateFin
      const creneauMatch = r.creneau === creneau || r.creneau === 'journee'
      return isInRange && creneauMatch
    })
  }

  // Get presence for a specific day and créneau
  const getPresenceForCell = (jour: JourSemaine, creneau: Creneau): { collaborateurId: number; name: string }[] => {
    const key = `${jour}:${creneau}`
    return presenceMap.get(key) || []
  }

  const todayStr = formatDate(new Date())
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() &&
                         currentMonth.getFullYear() === new Date().getFullYear()

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Chargement du planning...
      </div>
    )
  }

  return (
    <div>
      {/* Navigation mois */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Mois précédent"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {MOIS_LABELS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors flex items-center gap-1"
            >
              <ArrowUturnLeftIcon className="w-3 h-3" />
              Aujourd&apos;hui
            </button>
          )}
        </div>

        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Mois suivant"
        >
          <ChevronRightIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Grille calendrier mois */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs table-fixed">
          <thead>
            <tr>
              <th className="w-12 p-1 text-left text-xs font-medium text-gray-500 uppercase"></th>
              {JOURS_CALENDRIER.map((jour) => (
                <th
                  key={jour}
                  className="p-1 text-center text-xs font-medium text-gray-500 uppercase"
                  colSpan={2}
                >
                  {JOUR_LABELS[jour]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-gray-200">
              <th className="w-12"></th>
              {JOURS_CALENDRIER.map((jour) => (
                <th key={jour} colSpan={2} className="py-1 px-1">
                  <div className="flex">
                    <div className="flex-1 text-center text-[10px] text-gray-400">Mat</div>
                    <div className="flex-1 text-center text-[10px] text-gray-400">AM</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex} className="border-b border-gray-200">
                <td className="p-1 text-xs font-medium text-gray-500 align-middle border-r border-gray-100">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400">Sem.</div>
                    <div>{getWeekNumber(week[0])}</div>
                  </div>
                </td>
                {JOURS_CALENDRIER.map((jour) => {
                  const date = week.find(d => getJourSemaine(d) === jour)

                  if (!date) {
                    return creneaux.map((creneau) => (
                      <td key={`${weekIndex}-${jour}-${creneau}`} className="p-0.5">
                        <div className="h-[50px] bg-gray-50 rounded border border-gray-200"></div>
                      </td>
                    ))
                  }

                  const dateStr = formatDate(date)
                  const isToday = dateStr === todayStr

                  return creneaux.map((creneau, creneauIndex) => {
                    const remplacement = getRemplacementForCell(dateStr, creneau)
                    const presencesList = getPresenceForCell(jour, creneau)
                    const hasPresence = presencesList.length > 0

                    let bgColor = 'bg-gray-50 border-gray-200'
                    let textColor = 'text-gray-400'

                    if (remplacement) {
                      bgColor = 'bg-purple-100 border-purple-300'
                      textColor = 'text-purple-700'
                    } else if (hasPresence) {
                      bgColor = 'bg-green-50 border-green-200'
                      textColor = 'text-green-700'
                    }

                    const todayLeftClass = isToday && creneauIndex === 0 ? 'border-l-2 border-l-purple-400' : ''
                    const todayRightClass = isToday && creneauIndex === 1 ? 'border-r-2 border-r-purple-400' : ''
                    const todayTopBottom = isToday ? 'border-t-2 border-t-purple-400 border-b-2 border-b-purple-400' : ''

                    return (
                      <td key={`${weekIndex}-${jour}-${creneau}`} className={`p-0.5 ${todayLeftClass} ${todayRightClass} ${todayTopBottom}`}>
                        <div className="relative">
                          {creneauIndex === 0 && (
                            <div className={`absolute top-0.5 left-1 text-[10px] font-semibold z-10 ${isToday ? 'text-purple-700' : 'text-gray-600'}`}>
                              {date.getDate()}
                            </div>
                          )}
                          <div
                            className={`
                              h-[50px] rounded border flex flex-col justify-end items-start pt-4 pb-1 px-1
                              ${bgColor} ${textColor}
                            `}
                            title={
                              remplacement
                                ? `${remplacement.collaborateurPrenom} ${remplacement.collaborateurNom} remplacé par ${remplacement.remplacantPrenom} ${remplacement.remplacantNom}`
                                : hasPresence
                                ? presencesList.map(p => p.name).join(', ')
                                : 'Aucune présence'
                            }
                          >
                            {remplacement ? (
                              <div className="text-[10px] leading-tight text-left w-full">
                                <div className="truncate line-through opacity-60">
                                  {remplacement.collaborateurPrenom} {remplacement.collaborateurNom?.toUpperCase()}
                                </div>
                                <Link
                                  href={`/remplacants/${remplacement.remplacantId}`}
                                  className="truncate font-medium hover:underline block"
                                >
                                  → {remplacement.remplacantPrenom} {remplacement.remplacantNom?.toUpperCase()}
                                </Link>
                              </div>
                            ) : hasPresence ? (
                              <div className="text-[10px] leading-tight text-left w-full">
                                {presencesList.slice(0, 1).map((p) => (
                                  <Link
                                    key={p.collaborateurId}
                                    href={`/collaborateurs/${p.collaborateurId}`}
                                    className="truncate block hover:underline"
                                  >
                                    {p.name}
                                  </Link>
                                ))}
                                {presencesList.length > 1 && (
                                  <div className="opacity-75">+{presencesList.length - 1}</div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    )
                  })
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="flex gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
          <span className="text-gray-600">Présent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div>
          <span className="text-gray-600">Remplacé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
          <span className="text-gray-600">Aucune présence</span>
        </div>
      </div>
    </div>
  )
}
