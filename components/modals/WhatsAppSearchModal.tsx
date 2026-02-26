'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface JourPresence {
  jour: string
  creneau: string
}

interface AbsenceEcole {
  id: number
  name: string
  joursPresence: string | null
  remplacementApresJours: number | null
  isRemplacee: boolean
  urgency: string
  joursRestants: number | null
}

interface RemplacantOption {
  id: number
  lastName: string
  firstName: string
  phone?: string | null
  email?: string | null
}

const CRENEAU_LABELS: Record<string, string> = {
  matin: 'Matin',
  apres_midi: 'Après-midi',
  journee: 'Journée',
}

const MOTIF_LABELS: Record<string, string> = {
  maladie: 'Maladie',
  conge: 'Congé',
  formation: 'Formation',
  autre: 'Autre',
}

interface WhatsAppSearchModalProps {
  isOpen: boolean
  onClose: () => void
  absenceId: number
  personFirstName: string | null
  personLastName: string | null
  dateDebut: string
  dateFin: string
  creneau: string
  motif: string
  ecoles: AbsenceEcole[]
  onSuccess: () => void
}

export default function WhatsAppSearchModal({
  isOpen,
  onClose,
  absenceId,
  personFirstName,
  personLastName,
  dateDebut,
  dateFin,
  creneau,
  motif,
  ecoles,
  onSuccess,
}: WhatsAppSearchModalProps) {
  const [availableRemplacants, setAvailableRemplacants] = useState<RemplacantOption[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [availableSearch, setAvailableSearch] = useState('')
  const [checkedRemplacants, setCheckedRemplacants] = useState<Set<number>>(new Set())
  const [showMessageStep, setShowMessageStep] = useState(false)
  const [selectedWhatsappEcoleId, setSelectedWhatsappEcoleId] = useState('')
  const [sendResults, setSendResults] = useState<{ name: string; phone: string; success: boolean; error?: string }[] | null>(null)
  const [sendingMessages, setSendingMessages] = useState(false)

  // Fetch available remplaçants when modal opens
  useEffect(() => {
    if (!isOpen) return
    setAvailableSearch('')
    setCheckedRemplacants(new Set())
    setShowMessageStep(false)
    setSendResults(null)
    setLoadingAvailable(true)

    const fetchAvailable = async () => {
      try {
        const params = new URLSearchParams({
          isActive: 'true',
          availableFrom: dateDebut,
          availableTo: dateFin,
        })
        const res = await fetch(`/api/remplacants?${params.toString()}`)
        const data = await res.json()
        setAvailableRemplacants(
          (data.data || []).map((r: RemplacantOption) => ({
            id: r.id,
            lastName: r.lastName,
            firstName: r.firstName,
            phone: r.phone || null,
            email: r.email || null,
          }))
        )
      } catch (error) {
        console.error('Error fetching available remplacants:', error)
      } finally {
        setLoadingAvailable(false)
      }
    }

    fetchAvailable()
  }, [isOpen, dateDebut, dateFin])

  const filteredAvailable = useMemo(() => {
    if (!availableSearch.trim()) return availableRemplacants
    const q = availableSearch.toLowerCase()
    return availableRemplacants.filter(
      (r) => r.lastName.toLowerCase().includes(q) || r.firstName.toLowerCase().includes(q)
    )
  }, [availableRemplacants, availableSearch])

  const toggleChecked = (id: number) => {
    setCheckedRemplacants(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const allFilteredChecked = filteredAvailable.length > 0 && filteredAvailable.every(r => checkedRemplacants.has(r.id))
    if (allFilteredChecked) {
      // Uncheck only the filtered items, preserve others
      setCheckedRemplacants(prev => {
        const next = new Set(prev)
        for (const r of filteredAvailable) next.delete(r.id)
        return next
      })
    } else {
      // Check all filtered items, preserve existing
      setCheckedRemplacants(prev => {
        const next = new Set(prev)
        for (const r of filteredAvailable) next.add(r.id)
        return next
      })
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const generateSchedulePreview = useCallback((ecoleId: string): string[] => {
    const jourNamesByDow: Record<number, string> = {
      1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi',
    }
    const jourAbrev: Record<string, string> = {
      lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven',
    }

    const ecole = ecoles.find(e => e.id.toString() === ecoleId)
    let joursPresence: JourPresence[] = []
    if (ecole?.joursPresence) {
      try {
        joursPresence = JSON.parse(ecole.joursPresence)
      } catch { /* ignore */ }
    }

    const jourCreneauMap: Record<string, string> = {}
    if (joursPresence.length > 0) {
      for (const jp of joursPresence) {
        const existing = jourCreneauMap[jp.jour]
        if (existing) {
          if ((existing === 'matin' && jp.creneau === 'apres_midi') ||
              (existing === 'apres_midi' && jp.creneau === 'matin')) {
            jourCreneauMap[jp.jour] = 'journee'
          }
        } else {
          jourCreneauMap[jp.jour] = jp.creneau
        }
      }
    }

    const start = new Date(dateDebut + 'T00:00:00')
    const end = new Date(dateFin + 'T00:00:00')
    const lines: string[] = []
    const current = new Date(start)

    while (current <= end) {
      const dow = current.getDay()
      if (dow >= 1 && dow <= 5) {
        const jourName = jourNamesByDow[dow]
        let creneauVal: string | null = null
        if (joursPresence.length > 0) {
          creneauVal = jourCreneauMap[jourName] || null
        } else {
          creneauVal = creneau
        }
        if (creneauVal) {
          const dateStr = current.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          const label = CRENEAU_LABELS[creneauVal] || creneauVal
          lines.push(`${jourAbrev[jourName]} ${dateStr}: ${label}`)
        }
      }
      current.setDate(current.getDate() + 1)
    }

    return lines
  }, [dateDebut, dateFin, creneau, ecoles])

  const handleSendMessage = () => {
    setSendResults(null)
    if (ecoles.length === 1) {
      setSelectedWhatsappEcoleId(ecoles[0].id.toString())
    } else {
      setSelectedWhatsappEcoleId('')
    }
    setShowMessageStep(true)
  }

  const handleSendWhatsApp = async () => {
    const selected = availableRemplacants.filter(r => checkedRemplacants.has(r.id))
    const recipients = selected
      .filter(r => r.phone)
      .map(r => ({ phone: r.phone!, name: `${r.firstName} ${r.lastName}`, remplacantId: r.id }))

    if (recipients.length === 0) {
      alert('Aucun remplaçant sélectionné avec un numéro de téléphone')
      return
    }

    const collaborateurName = `${personFirstName || ''} ${personLastName || ''}`.trim()
    const selectedEcole = ecoles.find(e => e.id.toString() === selectedWhatsappEcoleId)
    const ecoleName = selectedEcole?.name || ''

    let joursPresence: JourPresence[] | null = null
    if (selectedEcole?.joursPresence) {
      try {
        joursPresence = JSON.parse(selectedEcole.joursPresence)
      } catch { /* ignore */ }
    }

    setSendingMessages(true)
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          absenceId,
          dateDebut,
          dateFin,
          creneau: CRENEAU_LABELS[creneau],
          collaborateurName,
          ecoleName,
          joursPresence,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Erreur lors de l'envoi")
        return
      }

      setSendResults(data.data?.results || [])
      onSuccess()
    } catch (error) {
      console.error('Error sending WhatsApp:', error)
      alert("Erreur lors de l'envoi des messages")
    } finally {
      setSendingMessages(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-2xl">
        <div className="modal-header">
          <h3 className="text-lg font-semibold">Recherche de remplaçant</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          {!showMessageStep ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="font-medium text-gray-900">
                  {personLastName?.toUpperCase()} {personFirstName}
                </div>
                <div className="text-gray-600 mt-1">
                  {formatDate(dateDebut)}
                  {dateDebut !== dateFin && ` → ${formatDate(dateFin)}`}
                  {' • '}{CRENEAU_LABELS[creneau]}
                  {' • '}{MOTIF_LABELS[motif]}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom..."
                    value={availableSearch}
                    onChange={(e) => setAvailableSearch(e.target.value)}
                    className="form-input pl-9"
                  />
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {loadingAvailable ? '...' : `${availableRemplacants.length} disponible(s)`}
                </span>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {!loadingAvailable && filteredAvailable.length > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <input
                      type="checkbox"
                      checked={filteredAvailable.length > 0 && filteredAvailable.every(r => checkedRemplacants.has(r.id))}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      Tout sélectionner ({checkedRemplacants.size}/{filteredAvailable.length})
                    </span>
                  </div>
                )}

                <div className="max-h-72 overflow-y-auto">
                  {loadingAvailable ? (
                    <div className="flex items-center justify-center p-6">
                      <span className="inline-block w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
                      <span className="text-sm text-gray-500">Recherche des remplaçants disponibles...</span>
                    </div>
                  ) : filteredAvailable.length === 0 ? (
                    <p className="text-sm text-gray-500 p-6 text-center">
                      Aucun remplaçant disponible sur cette période
                    </p>
                  ) : (
                    filteredAvailable.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checkedRemplacants.has(r.id)}
                          onChange={() => toggleChecked(r.id)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">{r.lastName.toUpperCase()}</span>{' '}
                            <span className="text-gray-600">{r.firstName}</span>
                          </div>
                          {(r.phone || r.email) && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate">
                              {[r.phone, r.email].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/remplacants/${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-purple-600 hover:underline whitespace-nowrap"
                        >
                          Voir fiche
                        </Link>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!sendResults ? (
                <>
                  {ecoles.length > 1 && (
                    <div className="form-group">
                      <label className="form-label">École concernée *</label>
                      <select
                        value={selectedWhatsappEcoleId}
                        onChange={(e) => setSelectedWhatsappEcoleId(e.target.value)}
                        className="form-input"
                      >
                        <option value="">-- Sélectionner une école --</option>
                        {ecoles.map((ecole) => (
                          <option key={ecole.id} value={ecole.id}>
                            {ecole.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="form-label">Message WhatsApp</label>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-800">
                      <p>
                        Bonjour, nous recherchons un remplaçant pour{' '}
                        <strong>{personFirstName} {personLastName}</strong>
                        {selectedWhatsappEcoleId && (
                          <> à l&apos;école <strong>{ecoles.find(e => e.id.toString() === selectedWhatsappEcoleId)?.name}</strong></>
                        )}.
                      </p>
                      {selectedWhatsappEcoleId && (
                        <div className="mt-2">
                          <span className="font-medium">Horaires :</span>
                          <div className="mt-1 space-y-0.5 font-mono text-xs">
                            {generateSchedulePreview(selectedWhatsappEcoleId).map((line, i) => (
                              <div key={i}>{line}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {!selectedWhatsappEcoleId && ecoles.length === 0 && (
                        <p className="mt-1">
                          Du <strong>{formatDate(dateDebut)}</strong> au{' '}
                          <strong>{formatDate(dateFin)}</strong>{' '}
                          (<strong>{CRENEAU_LABELS[creneau]}</strong>).
                        </p>
                      )}
                      <p className="mt-2">Êtes-vous disponible ?</p>
                      <div className="flex gap-2 mt-3">
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-green-300 text-sm font-medium text-green-800 bg-white">Oui</span>
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-green-300 text-sm font-medium text-green-800 bg-white">Non</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Le remplaçant recevra ce message avec des boutons de réponse rapide.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      {availableRemplacants.filter(r => checkedRemplacants.has(r.id)).length} remplaçant(s) sélectionné(s)
                    </h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {availableRemplacants
                        .filter(r => checkedRemplacants.has(r.id))
                        .map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">{r.lastName.toUpperCase()}</span>{' '}
                              <span className="text-gray-600">{r.firstName}</span>
                            </div>
                            {r.phone ? (
                              <span className="text-xs text-gray-400">{r.phone}</span>
                            ) : (
                              <span className="text-xs text-red-400 italic">Pas de téléphone</span>
                            )}
                          </div>
                        ))}
                    </div>
                    {availableRemplacants.filter(r => checkedRemplacants.has(r.id) && !r.phone).length > 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        Les remplaçants sans téléphone ne recevront pas de message.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-700">Résultats de l&apos;envoi</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {sendResults.filter(r => r.success).length} envoyé(s)
                    </span>
                    {sendResults.filter(r => !r.success).length > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {sendResults.filter(r => !r.success).length} échoué(s)
                      </span>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {sendResults.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">{r.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{r.phone}</span>
                        </div>
                        {r.success ? (
                          <span className="status-badge-success">Envoyé</span>
                        ) : (
                          <span className="text-xs text-red-600" title={r.error}>{r.error || 'Erreur'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <div></div>
          <div className="modal-footer-actions">
            {showMessageStep ? (
              <>
                {!sendResults && (
                  <button
                    type="button"
                    onClick={() => setShowMessageStep(false)}
                    className="btn btn-secondary"
                    disabled={sendingMessages}
                  >
                    Retour
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  Fermer
                </button>
                {!sendResults && (
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    disabled={sendingMessages || (ecoles.length > 0 && !selectedWhatsappEcoleId)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingMessages ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Envoyer via WhatsApp
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={checkedRemplacants.size === 0}
                  className="btn btn-primary"
                >
                  Envoyer un message ({checkedRemplacants.size})
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
