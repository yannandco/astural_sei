'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

const COUNTRIES = [
  { code: 'CH', prefix: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: 'FR', prefix: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'DE', prefix: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: 'IT', prefix: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: 'BE', prefix: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: 'LU', prefix: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: 'ES', prefix: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: 'PT', prefix: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'GB', prefix: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'AT', prefix: '+43', flag: '🇦🇹', name: 'Autriche' },
]

function detectCountry(value: string): { country: typeof COUNTRIES[number]; localNumber: string } {
  const cleaned = value.replace(/\s/g, '')
  // Try to match a known prefix (longest first)
  const sorted = [...COUNTRIES].sort((a, b) => b.prefix.length - a.prefix.length)
  for (const c of sorted) {
    if (cleaned.startsWith(c.prefix)) {
      return { country: c, localNumber: cleaned.slice(c.prefix.length) }
    }
    // Handle 00xx format
    const doubleZero = '00' + c.prefix.slice(1)
    if (cleaned.startsWith(doubleZero)) {
      return { country: c, localNumber: cleaned.slice(doubleZero.length) }
    }
  }
  // Default to Switzerland
  return { country: COUNTRIES[0], localNumber: cleaned.startsWith('0') ? cleaned.slice(1) : cleaned }
}

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export default function PhoneInput({ value, onChange, className }: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { country: selectedCountry, localNumber } = detectCountry(value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleCountrySelect(country: typeof COUNTRIES[number]) {
    setIsOpen(false)
    // Reconstruct with new prefix
    onChange(localNumber ? `${country.prefix}${localNumber}` : country.prefix)
  }

  function handleLocalChange(newLocal: string) {
    // Remove non-digit chars except leading nothing
    const digits = newLocal.replace(/[^\d]/g, '')
    // Strip leading 0 (national format) when prefix is present
    const stripped = digits.startsWith('0') ? digits.slice(1) : digits
    onChange(stripped ? `${selectedCountry.prefix}${stripped}` : '')
  }

  return (
    <div className={`flex ${className || ''}`} ref={dropdownRef}>
      {/* Country selector button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="form-input rounded-r-none border-r-0 flex items-center gap-1 px-2 min-w-[90px] h-full"
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="text-xs text-gray-600">{selectedCountry.prefix}</span>
          <ChevronDownIcon className="w-3 h-3 text-gray-400 ml-auto" />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-56 max-h-60 overflow-y-auto">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCountrySelect(c)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-purple-50 flex items-center gap-2 ${
                  c.code === selectedCountry.code ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1">{c.name}</span>
                <span className="text-gray-400 text-xs">{c.prefix}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Phone number input */}
      <input
        type="tel"
        value={localNumber}
        onChange={(e) => handleLocalChange(e.target.value)}
        placeholder="XX XXX XX XX"
        className="form-input rounded-l-none flex-1"
      />
    </div>
  )
}
