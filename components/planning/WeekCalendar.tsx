'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import WeekNavigation from './WeekNavigation'
import CalendarCell from './CalendarCell'
import CellContextMenu from './CellContextMenu'
import AssignmentModal from './AssignmentModal'
import SpecificDateModal from './SpecificDateModal'
import PlanningLegend from './PlanningLegend'
import {
  Creneau,
  JourSemaine,
  DisponibilitePeriode,
  DisponibiliteRecurrente,
  DisponibiliteSpecifique,
  Affectation,
  VacancesScolaires,
  CellData,
  JOUR_LABELS,
  getWeekDates,
  formatDate,
  calculateCellStatusWithPeriodes,
} from './types'

interface WeekCalendarProps {
  remplacantId: number
  periodes: DisponibilitePeriode[]
  specifiques: DisponibiliteSpecifique[]
  affectations: Affectation[]
  vacances?: VacancesScolaires[]
  onRefresh: () => void
  readOnly?: boolean
}

export default function WeekCalendar({
  remplacantId,
  periodes,
  specifiques,
  affectations,
  vacances = [],
  onRefresh,
  readOnly = false,
}: WeekCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(monday.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return monday
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

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const creneaux: Creneau[] = ['matin', 'apres_midi']

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

  // Générer les données de cellule
  const getCellData = useCallback(
    (date: Date, creneau: Creneau): CellData => {
      const dateStr = formatDate(date)
      const { status, affectation, specifique } = calculateCellStatusWithPeriodes(
        dateStr,
        creneau,
        periodes,
        specifiques,
        affectations
      )
      const { isVacances, nom: vacancesNom } = isDateInVacances(dateStr)

      return {
        date: dateStr,
        creneau,
        status,
        affectation,
        specifique,
        isVacances,
        vacancesNom,
      }
    },
    [periodes, specifiques, affectations, isDateInVacances]
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

  return (
    <div>
      <WeekNavigation
        weekStart={weekStart}
        onPrevious={goToPreviousWeek}
        onNext={goToNextWeek}
        onToday={goToToday}
      />

      {/* Bandeau vacances si applicable */}
      {weekDates.some((d) => isDateInVacances(formatDate(d)).isVacances) && (
        <div className="mb-3 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-sm text-yellow-800">
          {weekDates
            .filter((d) => isDateInVacances(formatDate(d)).isVacances)
            .map((d) => isDateInVacances(formatDate(d)).nom)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(', ')}
        </div>
      )}

      {/* Grille calendrier */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="w-20 p-2 text-left text-xs font-medium text-gray-500 uppercase"></th>
              {weekDates.map((date) => {
                const dateStr = formatDate(date)
                const { isVacances } = isDateInVacances(dateStr)
                const isToday = formatDate(new Date()) === dateStr

                return (
                  <th
                    key={dateStr}
                    className={`p-2 text-center text-xs font-medium uppercase ${
                      isVacances ? 'bg-yellow-50' : ''
                    } ${isToday ? 'bg-purple-50' : ''}`}
                  >
                    <div className="text-gray-500">
                      {JOUR_LABELS[['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'][weekDates.indexOf(date)] as JourSemaine]}
                    </div>
                    <div className={`text-sm ${isToday ? 'text-purple-700 font-bold' : 'text-gray-700'}`}>
                      {date.getDate()}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {creneaux.map((creneau) => (
              <tr key={creneau}>
                <td className="p-2 text-xs font-medium text-gray-600">
                  {creneau === 'matin' ? 'Matin' : 'Après-midi'}
                </td>
                {weekDates.map((date) => {
                  const cellData = getCellData(date, creneau)
                  return (
                    <td key={`${formatDate(date)}-${creneau}`} className="p-1">
                      <CalendarCell
                        data={cellData}
                        onClick={readOnly ? undefined : (data) => handleCellClick(data, window.event as unknown as React.MouseEvent)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="mt-4">
        <PlanningLegend />
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
