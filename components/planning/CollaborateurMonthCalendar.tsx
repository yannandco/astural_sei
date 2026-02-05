'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import {
  Creneau,
  JourSemaine,
  JOUR_LABELS,
  JOURS_CALENDRIER,
  CRENEAU_LABELS,
  formatDate,
  getJourSemaine,
} from './types'

interface JourPresence {
  jour: JourSemaine
  creneau: Creneau
}

interface Presence {
  ecoleId: number
  ecoleName: string
  joursPresence: JourPresence[]
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
}

interface CollaborateurMonthCalendarProps {
  presences: Presence[]
  remplacements: Remplacement[]
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

export default function CollaborateurMonthCalendar({
  presences,
  remplacements,
}: CollaborateurMonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  // Obtenir tous les jours ouvrés du mois (Lu-Ve)
  const monthWorkDays = useMemo(() => {
    const days: Date[] = []
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const lastDay = new Date(year, month + 1, 0).getDate()

    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month, d)
      const dayOfWeek = date.getDay()
      // Seulement Lu (1) à Ve (5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push(date)
      }
    }
    return days
  }, [currentMonth])

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
      const creneauMatch = r.creneau === creneau || r.creneau === 'journee' || creneau === 'journee'
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

  const todayStr = formatDate(new Date())
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() &&
                         currentMonth.getFullYear() === new Date().getFullYear()

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
                        <div className="h-[60px] bg-gray-50 rounded border border-gray-200"></div>
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
                              h-[60px] rounded border flex flex-col justify-end items-start pt-4 pb-1 px-1
                              ${bgColor} ${textColor}
                            `}
                            title={
                              remplacement
                                ? `Remplacé par ${remplacement.remplacantPrenom} ${remplacement.remplacantNom}`
                                : hasPresence
                                ? presencesList.map(p => p.ecoleName).join(', ')
                                : 'Non présent'
                            }
                          >
                            {remplacement ? (
                              <Link
                                href={`/remplacants/${remplacement.remplacantId}`}
                                className="text-[10px] hover:underline leading-tight block w-full text-left"
                              >
                                <div className="truncate text-gray-400 mb-0.5">Est remplacé par</div>
                                <div className="truncate font-medium">
                                  {remplacement.remplacantPrenom} {remplacement.remplacantNom?.toUpperCase()}
                                </div>
                                {remplacement.ecoleNom && (
                                  <div className="truncate font-normal opacity-75">
                                    {remplacement.ecoleNom}
                                  </div>
                                )}
                              </Link>
                            ) : hasPresence ? (
                              <div className="text-[10px] leading-tight">
                                {presencesList.slice(0, 1).map((p) => (
                                  <div key={p.ecoleId} className="truncate">
                                    {p.ecoleName}
                                  </div>
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
    </div>
  )
}
