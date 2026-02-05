'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface WeekNavigationProps {
  weekStart: Date
  onPrevious: () => void
  onNext: () => void
  onToday?: () => void
}

export default function WeekNavigation({
  weekStart,
  onPrevious,
  onNext,
  onToday,
}: WeekNavigationProps) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 4) // Vendredi

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-CH', {
      day: 'numeric',
      month: 'long',
    })
  }

  const year = weekStart.getFullYear()

  return (
    <div className="flex items-center justify-between mb-4">
      <button
        type="button"
        onClick={onPrevious}
        className="p-2 rounded-lg hover:bg-purple-50 transition-colors"
        title="Semaine précédente"
      >
        <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
      </button>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">
          Semaine du {formatDate(weekStart)} au {formatDate(weekEnd)} {year}
        </span>
        {onToday && (
          <button
            type="button"
            onClick={onToday}
            className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
          >
            Aujourd'hui
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="p-2 rounded-lg hover:bg-purple-50 transition-colors"
        title="Semaine suivante"
      >
        <ChevronRightIcon className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  )
}
