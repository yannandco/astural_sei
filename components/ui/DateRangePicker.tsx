'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { DayPicker, DateRange } from 'react-day-picker'
import { fr } from 'date-fns/locale'
import {
  format,
  parse,
  isValid,
  isSameDay,
  addDays,
  addWeeks,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { CalendarIcon } from '@heroicons/react/24/outline'
import 'react-day-picker/src/style.css'

interface DateRangePickerProps {
  valueStart: string
  valueEnd: string
  onChangeStart: (value: string) => void
  onChangeEnd: (value: string) => void
  disabled?: boolean
  className?: string
  required?: boolean
}

interface Preset {
  label: string
  getRange: () => { from: Date; to: Date }
}

export default function DateRangePicker({
  valueStart,
  valueEnd,
  onChangeStart,
  onChangeEnd,
  disabled = false,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [displayMonth, setDisplayMonth] = useState(() => {
    if (valueStart) {
      const d = parse(valueStart, 'yyyy-MM-dd', new Date())
      return isValid(d) ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date()
    }
    return new Date()
  })
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedRange: DateRange | undefined = useMemo(() => {
    const from = valueStart ? parse(valueStart, 'yyyy-MM-dd', new Date()) : undefined
    const to = valueEnd ? parse(valueEnd, 'yyyy-MM-dd', new Date()) : undefined
    if (from && isValid(from)) {
      return { from, to: to && isValid(to) ? to : undefined }
    }
    return undefined
  }, [valueStart, valueEnd])

  const presets = useMemo<Preset[]>(() => {
    const today = new Date()
    const monday = startOfWeek(today, { weekStartsOn: 1 })
    const friday = endOfWeek(today, { weekStartsOn: 6 })
    const nextMonday = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 })
    const nextFriday = addDays(nextMonday, 4)
    return [
      { label: "Aujourd'hui", getRange: () => ({ from: today, to: today }) },
      { label: 'Cette semaine', getRange: () => ({ from: monday, to: friday }) },
      { label: 'Semaine prochaine', getRange: () => ({ from: nextMonday, to: nextFriday }) },
      { label: '2 semaines', getRange: () => ({ from: today, to: addDays(today, 13) }) },
      { label: '1 mois', getRange: () => ({ from: today, to: addWeeks(today, 4) }) },
    ]
  }, [])

  const activePresetIndex = useMemo(() => {
    if (!selectedRange?.from || !selectedRange?.to) return -1
    return presets.findIndex((p) => {
      const r = p.getRange()
      return isSameDay(r.from, selectedRange.from!) && isSameDay(r.to, selectedRange.to!)
    })
  }, [selectedRange, presets])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      onChangeStart(format(range.from, 'yyyy-MM-dd'))
      if (range.to) {
        onChangeEnd(format(range.to, 'yyyy-MM-dd'))
      } else {
        onChangeEnd(format(range.from, 'yyyy-MM-dd'))
      }
    } else {
      onChangeStart('')
      onChangeEnd('')
    }
  }

  const handlePresetClick = (preset: Preset) => {
    const { from, to } = preset.getRange()
    onChangeStart(format(from, 'yyyy-MM-dd'))
    onChangeEnd(format(to, 'yyyy-MM-dd'))
    setDisplayMonth(new Date(from.getFullYear(), from.getMonth(), 1))
    setIsOpen(false)
  }

  const handleClear = () => {
    onChangeStart('')
    onChangeEnd('')
  }

  const handleGoToToday = () => {
    const today = new Date()
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const formatDisplay = () => {
    if (!valueStart) return ''
    const from = parse(valueStart, 'yyyy-MM-dd', new Date())
    const fromStr = isValid(from) ? format(from, 'dd/MM/yy') : ''
    if (!valueEnd || valueStart === valueEnd) return fromStr
    const to = parse(valueEnd, 'yyyy-MM-dd', new Date())
    const toStr = isValid(to) ? format(to, 'dd/MM/yy') : ''
    return `${fromStr} → ${toStr}`
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={formatDisplay()}
          readOnly
          onFocus={() => setIsOpen(true)}
          onClick={() => !disabled && setIsOpen(true)}
          placeholder="Sélectionner les dates"
          disabled={disabled}
          className="form-input pr-10 cursor-pointer"
        />
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl ring-1 ring-black/5 rdp-purple-theme">
          <div className="flex">
            {/* Presets */}
            <div className="border-r border-gray-100 p-2 flex flex-col gap-0.5 min-w-[160px]" style={{ paddingTop: '1.5rem' }}>
              {presets.map((preset, i) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`text-left text-[13px] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    activePresetIndex === i
                      ? 'bg-purple-100 text-purple-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Calendar */}
            <div className="flex flex-col">
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={handleRangeSelect}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                locale={fr}
                weekStartsOn={1}
                showOutsideDays
                fixedWeeks
              />

              {/* Footer */}
              <div className="flex items-center justify-between mx-3 mb-3 mt-0 pt-2.5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Effacer
                </button>
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors"
                >
                  Aujourd&apos;hui
                </button>
                {selectedRange?.from && selectedRange?.to && (
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-md transition-colors"
                  >
                    Appliquer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
