'use client'

import { useEffect, useRef } from 'react'
import { CellData, CellStatus } from './types'
import {
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  CalendarIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

interface CellContextMenuProps {
  data: CellData
  position: { x: number; y: number }
  onClose: () => void
  onAddException: () => void
  onRemoveException: () => void
  onAddPonctuel: () => void
  onCreateAffectation: () => void
  onViewAffectation?: () => void
}

export default function CellContextMenu({
  data,
  position,
  onClose,
  onAddException,
  onRemoveException,
  onAddPonctuel,
  onCreateAffectation,
  onViewAffectation,
}: CellContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Ajuster la position pour éviter le débordement
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 200),
  }

  const renderMenuItems = () => {
    switch (data.status) {
      case 'disponible_recurrent':
        return (
          <>
            <MenuItem
              icon={<XMarkIcon className="w-4 h-4" />}
              label="Ajouter exception (indisponible)"
              onClick={onAddException}
            />
            <MenuItem
              icon={<CalendarIcon className="w-4 h-4" />}
              label="Créer affectation"
              onClick={onCreateAffectation}
            />
          </>
        )

      case 'disponible_specifique':
        return (
          <>
            <MenuItem
              icon={<TrashIcon className="w-4 h-4" />}
              label="Supprimer disponibilité"
              onClick={onRemoveException}
              danger
            />
            <MenuItem
              icon={<CalendarIcon className="w-4 h-4" />}
              label="Créer affectation"
              onClick={onCreateAffectation}
            />
          </>
        )

      case 'indisponible_exception':
        return (
          <MenuItem
            icon={<TrashIcon className="w-4 h-4" />}
            label="Supprimer exception"
            onClick={onRemoveException}
            danger
          />
        )

      case 'indisponible':
        return (
          <MenuItem
            icon={<PlusIcon className="w-4 h-4" />}
            label="Ajouter disponibilité ponctuelle"
            onClick={onAddPonctuel}
          />
        )

      case 'affecte':
        return (
          <>
            {onViewAffectation && (
              <MenuItem
                icon={<InformationCircleIcon className="w-4 h-4" />}
                label="Voir détails affectation"
                onClick={onViewAffectation}
              />
            )}
          </>
        )

      default:
        return null
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {renderMenuItems()}
    </div>
  )
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

function MenuItem({ icon, label, onClick, danger = false }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full px-4 py-2 text-sm text-left flex items-center gap-2
        ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}
        transition-colors
      `}
    >
      {icon}
      {label}
    </button>
  )
}
