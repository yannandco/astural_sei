'use client'

import { CellData, CellStatus, CRENEAU_LABELS, MOTIF_LABELS } from './types'
import { XMarkIcon, CheckIcon, ArrowRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface CalendarCellProps {
  data: CellData
  onClick?: (data: CellData) => void
  showCreneauLabel?: boolean
  compact?: boolean
  isToday?: boolean
}

const STATUS_STYLES: Record<CellStatus, string> = {
  indisponible: 'bg-gray-100 border-gray-200 text-gray-400',
  disponible_recurrent: 'bg-green-100 border-green-300 text-green-700',
  disponible_specifique: 'bg-green-200 border-green-400 text-green-800',
  indisponible_exception: 'bg-red-100 border-red-300 text-red-700',
  affecte: 'bg-purple-100 border-purple-300 text-purple-700',
  absent_non_remplace: 'bg-red-200 border-red-400 text-red-800',
  absent_remplace: 'bg-orange-100 border-orange-300 text-orange-700',
}

const VACANCES_STYLES = 'bg-amber-100 border-amber-300 text-amber-700'

const STATUS_HOVER: Record<CellStatus, string> = {
  indisponible: 'hover:bg-gray-200',
  disponible_recurrent: 'hover:bg-green-200',
  disponible_specifique: 'hover:bg-green-300',
  indisponible_exception: 'hover:bg-red-200',
  affecte: 'hover:bg-purple-200',
  absent_non_remplace: 'hover:bg-red-300',
  absent_remplace: 'hover:bg-orange-200',
}

export default function CalendarCell({
  data,
  onClick,
  showCreneauLabel = false,
  compact = false,
  isToday = false,
}: CalendarCellProps) {
  const { status, affectation, specifique, isVacances, vacancesNom } = data

  // Vacances override les styles de statut
  const styleClasses = isVacances ? VACANCES_STYLES : STATUS_STYLES[status]
  const hoverClasses = isVacances ? 'hover:bg-amber-200' : STATUS_HOVER[status]

  const baseClasses = `
    rounded
    ${compact ? 'p-1 text-[10px]' : 'p-2 text-sm'}
    ${styleClasses}
    border
    ${onClick ? `cursor-pointer ${hoverClasses}` : ''}
    transition-colors
    relative
  `

  const handleClick = () => {
    if (onClick) {
      onClick(data)
    }
  }

  const renderContent = () => {
    if ((status === 'absent_non_remplace' || status === 'absent_remplace') && data.absence) {
      return (
        <div className={`flex flex-col ${compact ? 'items-start text-[10px] leading-tight w-full' : 'items-center'}`}>
          {compact ? (
            <>
              <div className="truncate w-full font-medium">
                {MOTIF_LABELS[data.absence.motif] || data.absence.motif}
              </div>
              {status === 'absent_remplace' && (
                <div className="truncate w-full opacity-75">Remplacé</div>
              )}
            </>
          ) : (
            <>
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span className="text-xs">{MOTIF_LABELS[data.absence.motif] || data.absence.motif}</span>
            </>
          )}
        </div>
      )
    }

    if (status === 'affecte' && affectation) {
      return (
        <div className={`flex flex-col ${compact ? 'items-start text-[10px] leading-tight w-full' : 'items-center'}`}>
          {compact ? (
            <>
              <div className="truncate w-full text-gray-400 mb-0.5">Remplace</div>
              <div className="truncate w-full font-medium">
                {affectation.collaborateurPrenom} {affectation.collaborateurNom?.toUpperCase()}
              </div>
              {affectation.ecoleNom && (
                <div className="truncate w-full opacity-75">
                  {affectation.ecoleNom}
                </div>
              )}
            </>
          ) : (
            <>
              <ArrowRightIcon className="w-4 h-4" />
              <span className="text-xs truncate max-w-full" title={`${affectation.collaborateurPrenom} ${affectation.collaborateurNom}`}>
                {affectation.collaborateurPrenom} {affectation.collaborateurNom?.toUpperCase()}
              </span>
            </>
          )}
        </div>
      )
    }

    if (status === 'indisponible_exception') {
      return <XMarkIcon className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} mx-auto`} />
    }

    // Disponible ou indisponible ou vacances - case vide
    return null
  }

  return (
    <div
      className={baseClasses}
      onClick={handleClick}
      title={
        isVacances
          ? `${vacancesNom} - ${CRENEAU_LABELS[data.creneau]}`
          : data.absence
            ? `Absent - ${MOTIF_LABELS[data.absence.motif] || data.absence.motif}${data.absence.motifDetails ? ` (${data.absence.motifDetails})` : ''}`
            : affectation
              ? `Remplace ${affectation.collaborateurPrenom} ${affectation.collaborateurNom} (${affectation.ecoleNom})`
              : specifique?.note || CRENEAU_LABELS[data.creneau]
      }
    >
      {showCreneauLabel && (
        <div className="text-xs text-gray-500 mb-1">{CRENEAU_LABELS[data.creneau]}</div>
      )}
      <div className={`flex items-end ${compact ? 'justify-start h-[52px] pt-5' : 'justify-center min-h-[24px]'}`}>
        {renderContent()}
      </div>
    </div>
  )
}
