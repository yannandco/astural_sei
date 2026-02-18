'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { DayPicker } from 'react-day-picker'
import { fr } from 'date-fns/locale'
import {
  format,
  parse,
  isValid,
  addDays,
  addWeeks,
  nextSaturday,
  startOfWeek,
  isSaturday,
  isSunday,
  isSameDay,
} from 'date-fns'
import { CalendarIcon } from '@heroicons/react/24/outline'
import 'react-day-picker/src/style.css'

interface DatePickerProps {
  value: string // Format YYYY-MM-DD
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

interface Preset {
  label: string
  getDate: () => Date
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yy',
  disabled = false,
  className = '',
  required = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [displayMonth, setDisplayMonth] = useState(() => {
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', new Date())
      return isValid(d) ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date()
    }
    return new Date()
  })
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined

  const presets = useMemo<Preset[]>(() => {
    const today = new Date()
    return [
      { label: "Aujourd'hui", getDate: () => today },
      { label: 'Demain', getDate: () => addDays(today, 1) },
      {
        label: 'Ce week-end',
        getDate: () => (isSaturday(today) || isSunday(today) ? today : nextSaturday(today)),
      },
      {
        label: 'Lundi prochain',
        getDate: () => startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 }),
      },
      {
        label: 'Week-end prochain',
        getDate: () => nextSaturday(addWeeks(today, isSaturday(today) || isSunday(today) ? 0 : 1)),
      },
      { label: 'Dans 2 semaines', getDate: () => addWeeks(today, 2) },
      { label: 'Dans 4 semaines', getDate: () => addWeeks(today, 4) },
    ]
  }, [])

  // Check which preset matches the current value
  const activePresetIndex = useMemo(() => {
    if (!selectedDate) return -1
    return presets.findIndex((p) => isSameDay(p.getDate(), selectedDate))
  }, [selectedDate, presets])

  useEffect(() => {
    if (value) {
      const date = parse(value, 'yyyy-MM-dd', new Date())
      if (isValid(date)) {
        setInputValue(format(date, 'dd/MM/yy'))
      }
    } else {
      setInputValue('')
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputValue(raw)

    if (raw.length === 8) {
      const parsed = parse(raw, 'dd/MM/yy', new Date())
      if (isValid(parsed)) {
        onChange(format(parsed, 'yyyy-MM-dd'))
        setDisplayMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1))
      }
    }
    if (raw.length === 10) {
      const parsed = parse(raw, 'dd/MM/yyyy', new Date())
      if (isValid(parsed)) {
        onChange(format(parsed, 'yyyy-MM-dd'))
        setDisplayMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1))
      }
    }
    if (raw === '') {
      onChange('')
    }
  }

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
      setInputValue(format(date, 'dd/MM/yy'))
    } else {
      onChange('')
      setInputValue('')
    }
    setIsOpen(false)
  }

  const handlePresetClick = (preset: Preset) => {
    const date = preset.getDate()
    onChange(format(date, 'yyyy-MM-dd'))
    setInputValue(format(date, 'dd/MM/yy'))
    setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setInputValue('')
  }

  const handleGoToToday = () => {
    const today = new Date()
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="form-input pr-10"
          autoComplete="off"
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
            {/* Presets (left) */}
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

            {/* Calendar (right) */}
            <div className="flex flex-col">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDaySelect}
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
                  Supprimer la date
                </button>
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors"
                >
                  Aujourd&apos;hui
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
