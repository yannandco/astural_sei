'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { fr } from 'date-fns/locale'
import { format, parse, isValid } from 'date-fns'
import { CalendarIcon } from '@heroicons/react/24/outline'
import 'react-day-picker/dist/style.css'

interface DatePickerProps {
  value: string // Format YYYY-MM-DD
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'jj/mm/aaaa',
  disabled = false,
  className = '',
  required = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Convertir YYYY-MM-DD en Date
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined

  // Synchroniser inputValue avec value
  useEffect(() => {
    if (value) {
      const date = parse(value, 'yyyy-MM-dd', new Date())
      if (isValid(date)) {
        setInputValue(format(date, 'dd/MM/yyyy'))
      }
    } else {
      setInputValue('')
    }
  }, [value])

  // Fermer le calendrier en cliquant ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Gérer la saisie manuelle
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputValue(raw)

    // Essayer de parser la date
    if (raw.length === 10) {
      const parsed = parse(raw, 'dd/MM/yyyy', new Date())
      if (isValid(parsed)) {
        onChange(format(parsed, 'yyyy-MM-dd'))
      }
    } else if (raw === '') {
      onChange('')
    }
  }

  // Gérer la sélection dans le calendrier
  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
      setInputValue(format(date, 'dd/MM/yyyy'))
    } else {
      onChange('')
      setInputValue('')
    }
    setIsOpen(false)
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
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            locale={fr}
            weekStartsOn={1}
            showOutsideDays
            fixedWeeks
            classNames={{
              root: 'p-3',
              months: 'flex flex-col',
              month: 'space-y-2',
              caption: 'flex justify-center relative items-center h-10',
              caption_label: 'text-sm font-medium text-gray-900',
              nav: 'flex items-center gap-1',
              nav_button: 'h-7 w-7 bg-transparent p-0 hover:bg-gray-100 rounded-md flex items-center justify-center',
              nav_button_previous: 'absolute left-1',
              nav_button_next: 'absolute right-1',
              table: 'w-full border-collapse',
              head_row: 'flex',
              head_cell: 'text-gray-500 w-8 font-normal text-xs text-center',
              row: 'flex w-full mt-1',
              cell: 'text-center text-sm relative p-0 focus-within:relative focus-within:z-20',
              day: 'h-8 w-8 p-0 font-normal rounded-md hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500',
              day_selected: 'bg-purple-600 text-white hover:bg-purple-700',
              day_today: 'font-bold text-purple-600',
              day_outside: 'text-gray-300',
              day_disabled: 'text-gray-300',
            }}
          />
        </div>
      )}
    </div>
  )
}
