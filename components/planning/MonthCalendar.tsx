'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import CalendarCell from './CalendarCell'
import CellContextMenu from './CellContextMenu'
import AssignmentModal from './AssignmentModal'
import SpecificDateModal from './SpecificDateModal'
import PlanningLegend from './PlanningLegend'
import {
  Creneau,
  JourSemaine,
  DisponibilitePeriode,
  DisponibiliteSpecifique,
  Affectation,
  AbsenceData,
  VacancesScolaires,
  CellData,
  JOUR_LABELS,
  JOURS_CALENDRIER,
  formatDate,
  calculateCellStatusWithPeriodes,
  getJourSemaine,
} from './types'

interface MonthCalendarProps {
  remplacantId: number
  periodes: DisponibilitePeriode[]
  specifiques: DisponibiliteSpecifique[]
  affectations: Affectation[]
  absences?: AbsenceData[]
  vacances?: VacancesScolaires[]
  onRefresh: () => void
  readOnly?: boolean
}

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

export default function MonthCalendar({
  remplacantId,
  periodes,
  specifiques,
  affectations,
  absences: absencesData = [],
  vacances = [],
  onRefresh,
  readOnly = false,
}: MonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const [contextMenu, setContextMenu] = useState<{
    data: CellData
    position: { x: number; y: number }
  } | null>(null)

  const [assignmentModal, setAssignmentModal] = useState<{
    isOpen: boolean
    date?: string
    creneau?: Creneau
    editingAffectation?: Affectation
  }>({ isOpen: false })

  const [specificModal, setSpecificModal] = useState<{
    isOpen: boolean
    date?: string
    creneau?: Creneau
    mode: 'add_available' | 'add_exception'
  }>({ isOpen: false, mode: 'add_available' })

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

  // Vérifier si une date est en vacances
  const isDateInVacances = useCallback(
    (date: string): { isVacances: boolean; nom?: string } => {
      const vacance = vacances.find((v) => date >= v.dateDebut && date <= v.dateFin)
      return vacance ? { isVacances: true, nom: vacance.nom } : { isVacances: false }
    },
    [vacances]
  )

  // Générer les données de cellule
  const getCellData = useCallback(
    (date: Date, creneau: Creneau): CellData => {
      const dateStr = formatDate(date)
      const { status, affectation, specifique, absence } = calculateCellStatusWithPeriodes(
        dateStr,
        creneau,
        periodes,
        specifiques,
        affectations,
        absencesData.length > 0 ? absencesData : undefined
      )
      const { isVacances, nom: vacancesNom } = isDateInVacances(dateStr)

      return {
        date: dateStr,
        creneau,
        status,
        affectation,
        specifique,
        absence,
        isVacances,
        vacancesNom,
      }
    },
    [periodes, specifiques, affectations, absencesData, isDateInVacances]
  )

  const handleCellClick = (data: CellData, event: React.MouseEvent) => {
    if (readOnly) return

    setContextMenu({
      data,
      position: { x: event.clientX, y: event.clientY },
    })
  }

  const closeContextMenu = () => setContextMenu(null)

  // Actions du menu contextuel
  const handleAddException = async () => {
    if (!contextMenu) return

    setSpecificModal({
      isOpen: true,
      date: contextMenu.data.date,
      creneau: contextMenu.data.creneau,
      mode: 'add_exception',
    })
    closeContextMenu()
  }

  const handleRemoveException = async () => {
    if (!contextMenu) return

    try {
      const res = await fetch(
        `/api/remplacants/${remplacantId}/disponibilites/specifiques?date=${contextMenu.data.date}&creneau=${contextMenu.data.creneau}`,
        { method: 'DELETE' }
      )

      if (res.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    }
    closeContextMenu()
  }

  const handleAddPonctuel = async () => {
    if (!contextMenu) return

    setSpecificModal({
      isOpen: true,
      date: contextMenu.data.date,
      creneau: contextMenu.data.creneau,
      mode: 'add_available',
    })
    closeContextMenu()
  }

  const handleCreateAffectation = () => {
    if (!contextMenu) return

    setAssignmentModal({
      isOpen: true,
      date: contextMenu.data.date,
      creneau: contextMenu.data.creneau,
    })
    closeContextMenu()
  }

  const handleViewAffectation = () => {
    if (!contextMenu?.data.affectation) return

    setAssignmentModal({
      isOpen: true,
      editingAffectation: contextMenu.data.affectation,
    })
    closeContextMenu()
  }

  const handleDeleteAffectation = async () => {
    if (!contextMenu?.data.affectation) return
    if (!confirm('Supprimer cette affectation ?')) {
      closeContextMenu()
      return
    }

    try {
      const res = await fetch(
        `/api/remplacants/${remplacantId}/affectations?affectationId=${contextMenu.data.affectation.id}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    }
    closeContextMenu()
  }

  // Sauvegarde affectation
  const handleSaveAffectation = async (data: {
    collaborateurId: number
    ecoleId: number
    dateDebut: string
    dateFin: string
    creneau: Creneau
    motif?: string
  }) => {
    const res = await fetch(`/api/remplacants/${remplacantId}/affectations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      onRefresh()
    } else {
      const { error } = await res.json()
      alert(error || 'Erreur lors de la création')
    }
  }

  // Sauvegarde date spécifique
  const handleSaveSpecific = async (data: {
    date: string
    creneau: Creneau
    isAvailable: boolean
    note?: string
  }) => {
    const res = await fetch(`/api/remplacants/${remplacantId}/disponibilites/specifiques`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      onRefresh()
    } else {
      const { error } = await res.json()
      alert(error || 'Erreur lors de l\'enregistrement')
    }
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
              Aujourd'hui
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
                        <div className="h-[64px] bg-gray-50 rounded border border-gray-200"></div>
                      </td>
                    ))
                  }

                  const dateStr = formatDate(date)
                  const isToday = dateStr === todayStr

                  return creneaux.map((creneau, creneauIndex) => {
                    const cellData = getCellData(date, creneau)

                    const todayLeftClass = isToday && creneauIndex === 0 ? 'border-l-2 border-l-purple-400' : ''
                    const todayRightClass = isToday && creneauIndex === 1 ? 'border-r-2 border-r-purple-400' : ''
                    const todayTopBottom = isToday ? 'border-t-2 border-t-purple-400 border-b-2 border-b-purple-400' : ''

                    return (
                      <td
                        key={`${weekIndex}-${jour}-${creneau}`}
                        className={`p-1 pb-2 ${creneauIndex === 0 ? 'pl-5' : ''} ${todayLeftClass} ${todayRightClass} ${todayTopBottom}`}
                      >
                        <div className="relative">
                          <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isToday ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 shadow-sm ring-1 ring-gray-200'}`}>
                            {date.getDate()}
                          </div>
                          <CalendarCell
                            data={cellData}
                            onClick={readOnly ? undefined : (data) => handleCellClick(data, window.event as unknown as React.MouseEvent)}
                            compact
                            isToday={isToday}
                          />
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
      <div className="mt-4">
        <PlanningLegend showAbsences={absencesData.length > 0} />
      </div>

      {/* Menu contextuel */}
      {contextMenu && (
        <CellContextMenu
          data={contextMenu.data}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onAddException={handleAddException}
          onRemoveException={handleRemoveException}
          onAddPonctuel={handleAddPonctuel}
          onCreateAffectation={handleCreateAffectation}
          onViewAffectation={contextMenu.data.affectation ? handleViewAffectation : undefined}
          onDeleteAffectation={contextMenu.data.affectation ? handleDeleteAffectation : undefined}
        />
      )}

      {/* Modal affectation */}
      <AssignmentModal
        remplacantId={remplacantId}
        isOpen={assignmentModal.isOpen}
        onClose={() => setAssignmentModal({ isOpen: false })}
        onSave={handleSaveAffectation}
        initialDate={assignmentModal.date}
        initialCreneau={assignmentModal.creneau}
        editingAffectation={assignmentModal.editingAffectation}
      />

      {/* Modal date spécifique */}
      <SpecificDateModal
        remplacantId={remplacantId}
        isOpen={specificModal.isOpen}
        onClose={() => setSpecificModal({ isOpen: false, mode: 'add_available' })}
        onSave={handleSaveSpecific}
        initialDate={specificModal.date}
        initialCreneau={specificModal.creneau}
        mode={specificModal.mode}
      />
    </div>
  )
}

// Helper pour obtenir le numéro de semaine
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
