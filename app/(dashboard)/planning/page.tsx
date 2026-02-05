'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { CalendarDaysIcon, CheckIcon, XMarkIcon, ArrowRightIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline'
import {
  WeekNavigation,
  PlanningLegend,
  DisponibilitePeriode,
  DisponibiliteSpecifique,
  Affectation,
  VacancesScolaires,
  JourSemaine,
  Creneau,
  CellStatus,
  JOUR_LABELS,
  CRENEAU_LABELS,
  getWeekDates,
  formatDate,
  calculateCellStatusWithPeriodes,
  getJourSemaine,
} from '@/components/planning'

type ViewMode = 'remplacants' | 'collaborateurs'

interface RemplacantPlanning {
  id: number
  lastName: string
  firstName: string
  isAvailable: boolean
  periodes: DisponibilitePeriode[]
  specifiques: DisponibiliteSpecifique[]
  affectations: Affectation[]
}

interface JourPresence {
  jour: JourSemaine
  creneau: Creneau
}

interface CollaborateurPresence {
  id: number
  ecoleId: number
  ecoleName: string | null
  joursPresence: string | null
}

interface CollaborateurRemplacement {
  id: number
  remplacantId: number
  remplacantNom: string | null
  remplacantPrenom: string | null
  collaborateurId: number
  ecoleId: number
  ecoleNom: string | null
  dateDebut: string
  dateFin: string
  creneau: Creneau
  motif: string | null
}

interface CollaborateurPlanning {
  id: number
  lastName: string
  firstName: string
  presences: CollaborateurPresence[]
  remplacements: CollaborateurRemplacement[]
}

const STATUS_STYLES: Record<CellStatus, string> = {
  indisponible: 'bg-gray-100 text-gray-400',
  disponible_recurrent: 'bg-green-100 text-green-700',
  disponible_specifique: 'bg-green-200 text-green-800',
  indisponible_exception: 'bg-red-100 text-red-700',
  affecte: 'bg-purple-100 text-purple-700',
}

export default function PlanningPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('remplacants')
  const [initialLoading, setInitialLoading] = useState(true)
  const [remplacants, setRemplacants] = useState<RemplacantPlanning[]>([])
  const [collaborateursData, setCollaborateursData] = useState<CollaborateurPlanning[]>([])
  const [vacances, setVacances] = useState<VacancesScolaires[]>([])

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
      if (viewMode === 'remplacants') {
        const [planningRes, vacRes] = await Promise.all([
          fetch(`/api/planning?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch(`/api/vacances-scolaires?startDate=${startDateStr}&endDate=${endDateStr}`),
        ])

        if (planningRes.ok) {
          const { data } = await planningRes.json()
          setRemplacants(data)
        }

        if (vacRes.ok) {
          const { data } = await vacRes.json()
          setVacances(data)
        }
      } else {
        const [collaborateursRes, vacRes] = await Promise.all([
          fetch(`/api/planning/collaborateurs?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch(`/api/vacances-scolaires?startDate=${startDateStr}&endDate=${endDateStr}`),
        ])

        if (collaborateursRes.ok) {
          const { data } = await collaborateursRes.json()
          setCollaborateursData(data)
        }

        if (vacRes.ok) {
          const { data } = await vacRes.json()
          setVacances(data)
        }
      }
    } catch (error) {
      console.error('Error fetching planning:', error)
    } finally {
      setInitialLoading(false)
    }
  }, [startDateStr, endDateStr, viewMode])

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

  // Vérifier si une date est en vacances
  const isDateInVacances = useCallback(
    (date: string): { isVacances: boolean; nom?: string } => {
      const vacance = vacances.find((v) => date >= v.dateDebut && date <= v.dateFin)
      return vacance ? { isVacances: true, nom: vacance.nom } : { isVacances: false }
    },
    [vacances]
  )

  // Obtenir le statut d'une cellule pour un remplaçant
  const getCellStatus = useCallback(
    (remplacant: RemplacantPlanning, date: string, creneau: Creneau): {
      status: CellStatus
      affectation?: Affectation
    } => {
      const { status, affectation } = calculateCellStatusWithPeriodes(
        date,
        creneau,
        remplacant.periodes,
        remplacant.specifiques,
        remplacant.affectations
      )
      return { status, affectation }
    },
    []
  )

  // Obtenir le statut d'une cellule pour un collaborateur
  const getCollaborateurCellStatus = useCallback(
    (collaborateur: CollaborateurPlanning, date: string, creneau: Creneau, jour: JourSemaine): {
      status: 'none' | 'presence' | 'remplace'
      remplacement?: CollaborateurRemplacement
      presenceEcoles?: string[]
    } => {
      // Vérifier d'abord s'il y a un remplacement
      const remplacement = collaborateur.remplacements.find((r) => {
        const isInDateRange = date >= r.dateDebut && date <= r.dateFin
        const isMatchingCreneau = r.creneau === creneau || r.creneau === 'journee'
        return isInDateRange && isMatchingCreneau
      })

      if (remplacement) {
        return { status: 'remplace', remplacement }
      }

      // Sinon vérifier les présences
      const matchingPresences: string[] = []
      for (const p of collaborateur.presences) {
        if (!p.joursPresence) continue
        try {
          const jours: JourPresence[] = JSON.parse(p.joursPresence)
          const hasPresence = jours.some((jp) => {
            const jourMatch = jp.jour === jour
            const creneauMatch = jp.creneau === creneau || jp.creneau === 'journee'
            return jourMatch && creneauMatch
          })
          if (hasPresence && p.ecoleName) {
            matchingPresences.push(p.ecoleName)
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (matchingPresences.length > 0) {
        return { status: 'presence', presenceEcoles: matchingPresences }
      }

      return { status: 'none' }
    },
    []
  )

  const creneaux: Creneau[] = ['matin', 'apres_midi']

  // Vérifier si des vacances sont actives cette semaine
  const vacancesThisWeek = weekDates.some((d) => isDateInVacances(formatDate(d)).isVacances)
  const vacancesNames = vacancesThisWeek
    ? weekDates
        .filter((d) => isDateInVacances(formatDate(d)).isVacances)
        .map((d) => isDateInVacances(formatDate(d)).nom)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ')
    : null

  return (
    <div>
      {/* Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <CalendarDaysIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Planning</h1>
              <p className="ds-header-subtitle">
                {viewMode === 'remplacants' ? 'Disponibilités des remplaçants' : 'Planning des collaborateurs'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100">
        <div className="p-5">
          {/* Sticky navigation bar */}
          <div className="sticky top-0 z-30 bg-white pb-2 -mx-5 px-5 pt-2 border-b border-gray-100">
            {/* Tabs */}
            <div className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setViewMode('remplacants')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'remplacants'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserGroupIcon className="w-4 h-4" />
                Remplaçants
              </button>
              <button
                type="button"
                onClick={() => setViewMode('collaborateurs')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'collaborateurs'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UsersIcon className="w-4 h-4" />
                Collaborateurs
              </button>
            </div>

            {/* Week navigation */}
            <WeekNavigation
              weekStart={weekStart}
              onPrevious={goToPreviousWeek}
              onNext={goToNextWeek}
              onToday={goToToday}
            />
          </div>

          {/* Vacances banner */}
          {vacancesThisWeek && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-sm text-yellow-800">
              {vacancesNames}
            </div>
          )}

          {/* Loading state */}
          {initialLoading ? (
            <div className="text-center py-12 text-gray-500">Chargement...</div>
          ) : viewMode === 'remplacants' ? (
            /* Remplaçants view */
            remplacants.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucun remplaçant actif trouvé.
              </div>
            ) : (
              <>
                {/* Table */}
                <div>
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-purple-200">
                        <th className="sticky top-[123px] z-20 py-3 px-4 text-left text-xs font-semibold text-purple-700 uppercase w-48 bg-purple-50 border-b border-purple-200">
                          Remplaçant
                        </th>
                        {weekDates.map((date) => {
                          const dateStr = formatDate(date)
                          const { isVacances } = isDateInVacances(dateStr)
                          const isToday = formatDate(new Date()) === dateStr
                          const jour = getJourSemaine(date)
                          const todayBorderClass = isToday ? 'border-l-2 border-l-purple-400 border-r-2 border-r-purple-400 border-t-2 border-t-purple-400' : ''

                          return (
                            <th
                              key={dateStr}
                              className={`sticky top-[123px] z-20 py-3 px-2 text-center text-xs font-semibold uppercase border-r border-b border-purple-200 ${
                                isVacances ? 'bg-yellow-100' : 'bg-purple-50'
                              } ${todayBorderClass}`}
                              colSpan={2}
                            >
                              <div className="text-purple-600">{jour ? JOUR_LABELS[jour] : ''}</div>
                              <div className={`text-sm ${isToday ? 'text-purple-800 font-bold' : 'text-purple-700'}`}>
                                {date.getDate()}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                      {/* Sub-header for créneaux */}
                      <tr className="border-b border-purple-100">
                        <th className="sticky top-[175px] z-20 bg-purple-50"></th>
                        {weekDates.map((date) => {
                          const dateStr = formatDate(date)
                          const isToday = formatDate(new Date()) === dateStr
                          const todayBorderClass = isToday ? 'border-l-2 border-l-purple-400 border-r-2 border-r-purple-400' : ''
                          return (
                            <th key={dateStr} colSpan={2} className={`sticky top-[175px] z-20 py-1 px-1 border-r border-purple-200 bg-purple-50 ${todayBorderClass}`}>
                              <div className="flex">
                                <div className="flex-1 text-center text-[10px] text-purple-400">Mat</div>
                                <div className="flex-1 text-center text-[10px] text-purple-400">AM</div>
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {remplacants.map((remplacant) => (
                        <tr
                          key={remplacant.id}
                          className="border-b border-gray-100 hover:bg-purple-50/50 cursor-pointer transition-all outline outline-1 outline-transparent hover:outline-purple-300"
                        >
                          <td className="py-2 px-4">
                            <Link
                              href={`/remplacants/${remplacant.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-purple-600"
                            >
                              {remplacant.lastName} {remplacant.firstName}
                            </Link>
                            {!remplacant.isAvailable && (
                              <span className="ml-2 text-xs text-gray-400">(indisponible)</span>
                            )}
                          </td>
                          {weekDates.map((date) => {
                            const dateStr = formatDate(date)
                            const isToday = formatDate(new Date()) === dateStr
                            const { isVacances } = isDateInVacances(dateStr)
                            return creneaux.map((creneau) => {
                              const { status, affectation } = getCellStatus(remplacant, dateStr, creneau)
                              const borderClass = creneau === 'apres_midi' ? 'border-r border-gray-300' : ''
                              const todayLeftClass = isToday && creneau === 'matin' ? 'border-l-2 border-l-purple-400' : ''
                              const todayRightClass = isToday && creneau === 'apres_midi' ? 'border-r-2 border-r-purple-400' : ''

                              // Pendant les vacances, montrer une cellule vide jaune
                              if (isVacances) {
                                return (
                                  <td
                                    key={`${dateStr}-${creneau}`}
                                    className={`py-1 px-1 text-center bg-yellow-50 text-yellow-400 ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                  >
                                    <span className="text-xs">-</span>
                                  </td>
                                )
                              }

                              // Affecté - montrer les infos du remplacement
                              if (status === 'affecte' && affectation) {
                                return (
                                  <td
                                    key={`${dateStr}-${creneau}`}
                                    className={`py-1 px-1 ${STATUS_STYLES[status]} ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                    title={`Remplace ${affectation.collaborateurPrenom} ${affectation.collaborateurNom} - ${affectation.ecoleNom || ''}`}
                                  >
                                    <div className="text-xs text-purple-700 font-medium leading-tight text-left">
                                      <div className="truncate">
                                        {affectation.collaborateurPrenom} {affectation.collaborateurNom?.toUpperCase()}
                                      </div>
                                      {affectation.ecoleNom && (
                                        <div className="truncate text-purple-500 font-normal">
                                          {affectation.ecoleNom}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                )
                              }

                              // Disponible - montrer checkmark
                              if (status === 'disponible_recurrent' || status === 'disponible_specifique') {
                                return (
                                  <td
                                    key={`${dateStr}-${creneau}`}
                                    className={`py-1 px-1 text-center ${STATUS_STYLES[status]} ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                  >
                                    <CheckIcon className="w-4 h-4 mx-auto" />
                                  </td>
                                )
                              }

                              // Indisponible exception
                              if (status === 'indisponible_exception') {
                                return (
                                  <td
                                    key={`${dateStr}-${creneau}`}
                                    className={`py-1 px-1 text-center ${STATUS_STYLES[status]} ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                  >
                                    <XMarkIcon className="w-4 h-4 mx-auto" />
                                  </td>
                                )
                              }

                              // Indisponible par défaut
                              return (
                                <td
                                  key={`${dateStr}-${creneau}`}
                                  className={`py-1 px-1 text-center ${STATUS_STYLES[status]} ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                >
                                  <span className="text-xs">-</span>
                                </td>
                              )
                            })
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="mt-6">
                  <PlanningLegend />
                </div>
              </>
            )
          ) : (
            /* Collaborateurs view */
            collaborateursData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucun collaborateur avec des affectations trouvé.
              </div>
            ) : (
              <>
                {/* Table */}
                <div>
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-purple-200">
                        <th className="sticky top-[123px] z-20 py-3 px-4 text-left text-xs font-semibold text-purple-700 uppercase w-48 bg-purple-50 border-b border-purple-200">
                          Collaborateur
                        </th>
                        {weekDates.map((date) => {
                          const dateStr = formatDate(date)
                          const { isVacances } = isDateInVacances(dateStr)
                          const isToday = formatDate(new Date()) === dateStr
                          const jour = getJourSemaine(date)
                          const todayBorderClass = isToday ? 'border-l-2 border-l-purple-400 border-r-2 border-r-purple-400 border-t-2 border-t-purple-400' : ''

                          return (
                            <th
                              key={dateStr}
                              className={`sticky top-[123px] z-20 py-3 px-2 text-center text-xs font-semibold uppercase border-r border-b border-purple-200 ${
                                isVacances ? 'bg-yellow-100' : 'bg-purple-50'
                              } ${todayBorderClass}`}
                              colSpan={2}
                            >
                              <div className="text-purple-600">{jour ? JOUR_LABELS[jour] : ''}</div>
                              <div className={`text-sm ${isToday ? 'text-purple-800 font-bold' : 'text-purple-700'}`}>
                                {date.getDate()}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                      {/* Sub-header for créneaux */}
                      <tr className="border-b border-purple-100">
                        <th className="sticky top-[175px] z-20 bg-purple-50"></th>
                        {weekDates.map((date) => {
                          const dateStr = formatDate(date)
                          const isToday = formatDate(new Date()) === dateStr
                          const todayBorderClass = isToday ? 'border-l-2 border-l-purple-400 border-r-2 border-r-purple-400' : ''
                          return (
                            <th key={dateStr} colSpan={2} className={`sticky top-[175px] z-20 py-1 px-1 border-r border-purple-200 bg-purple-50 ${todayBorderClass}`}>
                              <div className="flex">
                                <div className="flex-1 text-center text-[10px] text-purple-400">Mat</div>
                                <div className="flex-1 text-center text-[10px] text-purple-400">AM</div>
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {collaborateursData.map((collaborateur) => (
                        <tr
                          key={collaborateur.id}
                          className="border-b border-gray-100 hover:bg-purple-50/50 cursor-pointer transition-all outline outline-1 outline-transparent hover:outline-purple-300"
                        >
                          <td className="py-2 px-4">
                            <Link
                              href={`/collaborateurs/${collaborateur.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-purple-600"
                            >
                              {collaborateur.lastName} {collaborateur.firstName}
                            </Link>
                          </td>
                          {weekDates.map((date) => {
                            const dateStr = formatDate(date)
                            const jour = getJourSemaine(date)
                            const { isVacances } = isDateInVacances(dateStr)
                            const isToday = formatDate(new Date()) === dateStr

                            return creneaux.map((creneau) => {
                              const borderClass = creneau === 'apres_midi' ? 'border-r border-gray-300' : ''
                              const todayLeftClass = isToday && creneau === 'matin' ? 'border-l-2 border-l-purple-400' : ''
                              const todayRightClass = isToday && creneau === 'apres_midi' ? 'border-r-2 border-r-purple-400' : ''

                              // Pendant les vacances, montrer une cellule vide jaune
                              if (isVacances) {
                                return (
                                  <td
                                    key={`${dateStr}-${creneau}`}
                                    className={`py-1 px-1 text-center bg-yellow-50 text-yellow-400 ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                  >
                                    <span className="text-xs">-</span>
                                  </td>
                                )
                              }

                              const { status, remplacement, presenceEcoles } = getCollaborateurCellStatus(
                                collaborateur,
                                dateStr,
                                creneau,
                                jour as JourSemaine
                              )

                              if (status === 'remplace' && remplacement) {
                                return (
                                  <td
                                    key={`${dateStr}-${creneau}`}
                                    className={`py-1 px-1 bg-purple-100 ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                    title={`Remplacé par ${remplacement.remplacantPrenom} ${remplacement.remplacantNom} - ${remplacement.ecoleNom || ''}`}
                                  >
                                    <Link
                                      href={`/remplacants/${remplacement.remplacantId}`}
                                      className="text-xs text-purple-700 hover:text-purple-900 font-medium leading-tight block"
                                    >
                                      <div className="truncate">
                                        {remplacement.remplacantPrenom} {remplacement.remplacantNom}
                                      </div>
                                      {remplacement.ecoleNom && (
                                        <div className="truncate text-purple-500 font-normal">
                                          {remplacement.ecoleNom}
                                        </div>
                                      )}
                                    </Link>
                                  </td>
                                )
                              }

                              if (status === 'presence' && presenceEcoles) {
                                return (
                                  <td
                                    key={`${dateStr}-${creneau}`}
                                    className={`py-1 px-1 bg-green-100 ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                    title={presenceEcoles.join(', ')}
                                  >
                                    <div className="text-xs text-green-700 font-medium leading-tight">
                                      {presenceEcoles.slice(0, 2).map((ecole, i) => (
                                        <div key={i} className="truncate">
                                          {ecole}
                                        </div>
                                      ))}
                                      {presenceEcoles.length > 2 && (
                                        <div className="text-green-500">+{presenceEcoles.length - 2}</div>
                                      )}
                                    </div>
                                  </td>
                                )
                              }

                              return (
                                <td
                                  key={`${dateStr}-${creneau}`}
                                  className={`py-1 px-1 text-center bg-gray-50 text-gray-300 ${borderClass} ${todayLeftClass} ${todayRightClass}`}
                                >
                                  <span className="text-xs">-</span>
                                </td>
                              )
                            })
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend for collaborateurs */}
                <div className="mt-6 text-xs text-gray-500 flex flex-wrap gap-4">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
                    Présence prévue
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></span>
                    Remplacé
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></span>
                    Non présent
                  </span>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// Helper component for cell icons
function CellIcon({ status }: { status: CellStatus }) {
  switch (status) {
    case 'disponible_recurrent':
    case 'disponible_specifique':
      return <CheckIcon className="w-4 h-4 mx-auto" />
    case 'indisponible_exception':
      return <XMarkIcon className="w-4 h-4 mx-auto" />
    case 'affecte':
      return <ArrowRightIcon className="w-4 h-4 mx-auto" />
    default:
      return <span className="text-xs">-</span>
  }
}
