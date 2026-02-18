'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import {
  Creneau,
  JourSemaine,
  AbsenceData,
  JOUR_LABELS,
  JOURS_CALENDRIER,
  CRENEAU_LABELS,
  MOTIF_LABELS,
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
  motif: string | null
}

export interface CellClickInfo {
  date: string
  creneau: Creneau
  type: 'presence' | 'absence'
}

interface CollaborateurMonthCalendarProps {
  presences: Presence[]
  remplacements: Remplacement[]
  absences?: AbsenceData[]
  onRemplacementClick?: (remplacement: Remplacement) => void
  onCellClick?: (info: CellClickInfo) => void
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
  absences: absencesData = [],
  onRemplacementClick,
  onCellClick,
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

  // Get absence for a specific date and créneau
  const getAbsenceForCell = (dateStr: string, creneau: Creneau): AbsenceData | undefined => {
    return absencesData.find(a => {
      const isInRange = dateStr >= a.dateDebut && dateStr <= a.dateFin
      const creneauMatch = a.creneau === creneau || a.creneau === 'journee' || creneau === 'journee'
      return isInRange && creneauMatch
    })
  }

  // Get all remplacements for a specific date and créneau
  const getRemplacementsForCell = (dateStr: string, creneau: Creneau): Remplacement[] => {
    return remplacements.filter(r => {
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
              {JOURS_CALENDRIER.map((jour) => (
                <th
                  key={jour}
                  className="p-1 pl-5 text-center text-xs font-medium text-gray-500 uppercase w-[20%]"
                  colSpan={2}
                >
                  {JOUR_LABELS[jour]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-gray-200">
              {JOURS_CALENDRIER.map((jour) => (
                <th key={jour} colSpan={2} className="py-1 px-1 pl-5">
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
                {JOURS_CALENDRIER.map((jour) => {
                  const date = week.find(d => getJourSemaine(d) === jour)

                  if (!date) {
                    return creneaux.map((creneau, ci) => (
                      <td key={`${weekIndex}-${jour}-${creneau}`} className={`p-1 pb-2 ${ci === 0 ? 'pl-5' : ''}`}>
                        <div className="h-[60px] bg-gray-50 rounded border border-gray-200"></div>
                      </td>
                    ))
                  }

                  const dateStr = formatDate(date)
                  const isToday = dateStr === todayStr

                  return creneaux.map((creneau, creneauIndex) => {
                    const absence = getAbsenceForCell(dateStr, creneau)
                    const cellRemplacements = getRemplacementsForCell(dateStr, creneau)
                    const remplacement = cellRemplacements[0]
                    const presencesList = getPresenceForCell(jour, creneau)
                    const hasPresence = presencesList.length > 0

                    let bgColor = 'bg-gray-50 border-gray-200'
                    let textColor = 'text-gray-400'
                    let isClickable = false

                    // N'afficher absence/remplacement que sur les créneaux où le collaborateur travaille
                    const showAbsence = absence && (hasPresence || cellRemplacements.length > 0)
                    const showRemplacement = remplacement && !showAbsence

                    if (showAbsence) {
                      if (absence!.isRemplacee && cellRemplacements.length > 0) {
                        bgColor = 'bg-orange-100 border-orange-300'
                        textColor = 'text-orange-700'
                        isClickable = !!onRemplacementClick
                      } else {
                        bgColor = 'bg-red-200 border-red-400'
                        textColor = 'text-red-800'
                        isClickable = !!onCellClick
                      }
                    } else if (showRemplacement) {
                      bgColor = 'bg-purple-100 border-purple-300'
                      textColor = 'text-purple-700'
                      isClickable = !!onRemplacementClick
                    } else if (hasPresence) {
                      bgColor = 'bg-green-50 border-green-200'
                      textColor = 'text-green-700'
                      isClickable = !!onCellClick
                    }

                    const clickableClass = isClickable ? 'cursor-pointer hover:ring-2 ring-purple-400' : ''

                    const todayLeftClass = isToday && creneauIndex === 0 ? 'border-l-2 border-l-purple-400' : ''
                    const todayRightClass = isToday && creneauIndex === 1 ? 'border-r-2 border-r-purple-400' : ''
                    const todayTopBottom = isToday ? 'border-t-2 border-t-purple-400 border-b-2 border-b-purple-400' : ''

                    const remplacementsTitlePart = cellRemplacements.map(r =>
                      `${r.remplacantPrenom} ${r.remplacantNom}${r.ecoleNom ? ` (${r.ecoleNom})` : ''}`
                    ).join(', ')

                    return (
                      <td key={`${weekIndex}-${jour}-${creneau}`} className={`p-1 pb-2 ${creneauIndex === 0 ? 'pl-5' : ''} ${todayLeftClass} ${todayRightClass} ${todayTopBottom}`}>
                        <div className="relative">
                          <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isToday ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 shadow-sm ring-1 ring-gray-200'}`}>
                            {date.getDate()}
                          </div>
                          <div
                            className={`
                              h-[64px] rounded border flex flex-col justify-end items-start pt-5 pb-1 px-1
                              ${bgColor} ${textColor} ${clickableClass}
                            `}
                            title={
                              showAbsence
                                ? (absence!.isRemplacee && cellRemplacements.length > 0
                                    ? `${MOTIF_LABELS[absence!.motif] || absence!.motif} — Remplacé par ${remplacementsTitlePart}`
                                    : `Absent - ${MOTIF_LABELS[absence!.motif] || absence!.motif}`)
                                : showRemplacement
                                  ? `Remplacé par ${remplacementsTitlePart}`
                                  : hasPresence
                                    ? presencesList.map(p => p.ecoleName).join(', ')
                                    : 'Non présent'
                            }
                            onClick={isClickable ? (e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if ((showAbsence && absence!.isRemplacee && remplacement) || showRemplacement) {
                                onRemplacementClick?.(remplacement!)
                              } else if (onCellClick) {
                                onCellClick({
                                  date: dateStr,
                                  creneau,
                                  type: showAbsence ? 'absence' : 'presence',
                                })
                              }
                            } : undefined}
                          >
                            {showAbsence ? (
                              absence!.isRemplacee && cellRemplacements.length > 0 ? (
                                <div className="text-[10px] leading-tight w-full">
                                  {cellRemplacements.slice(0, 2).map((r, i) => (
                                    <div key={r.id} className="truncate">
                                      <span className="font-medium">{r.remplacantPrenom} {r.remplacantNom?.toUpperCase()}</span>
                                    </div>
                                  ))}
                                  {cellRemplacements.length > 2 && (
                                    <div className="truncate opacity-75">+{cellRemplacements.length - 2}</div>
                                  )}
                                  {cellRemplacements[0]?.ecoleNom && (
                                    <div className="truncate opacity-75 text-[9px]">{cellRemplacements[0].ecoleNom}</div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-[10px] leading-tight w-full">
                                  <div className="truncate font-medium">
                                    {MOTIF_LABELS[absence!.motif] || absence!.motif}
                                  </div>
                                </div>
                              )
                            ) : showRemplacement ? (
                              <div className="text-[10px] leading-tight w-full">
                                {cellRemplacements.slice(0, 2).map((r, i) => (
                                  <div key={r.id} className="truncate">
                                    <span className="font-medium">{r.remplacantPrenom} {r.remplacantNom?.toUpperCase()}</span>
                                  </div>
                                ))}
                                {cellRemplacements.length > 2 && (
                                  <div className="truncate opacity-75">+{cellRemplacements.length - 2}</div>
                                )}
                                {cellRemplacements[0]?.ecoleNom && (
                                  <div className="truncate opacity-75 text-[9px]">{cellRemplacements[0].ecoleNom}</div>
                                )}
                              </div>
                            ) : hasPresence ? (
                              <div className="text-[10px] leading-tight">
                                {presencesList.slice(0, 2).map((p) => (
                                  <div key={p.ecoleId} className="truncate">
                                    {p.ecoleName}
                                  </div>
                                ))}
                                {presencesList.length > 2 && (
                                  <div className="opacity-75">+{presencesList.length - 2}</div>
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
      <div className="flex flex-wrap gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
          <span className="text-gray-600">Présence</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div>
          <span className="text-gray-600">Remplacé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-200 border border-red-400 rounded"></div>
          <span className="text-gray-600">Absent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
          <span className="text-gray-600">Absent (remplacé)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
          <span className="text-gray-600">Non présent</span>
        </div>
      </div>
    </div>
  )
}
