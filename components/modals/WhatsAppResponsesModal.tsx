'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline'

interface WhatsappResponseRow {
  id: number
  remplacantId: number
  phone: string
  status: string
  response: 'disponible' | 'pas_disponible' | null
  respondedAt: string | null
  createdAt: string
  remplacantFirstName: string | null
  remplacantLastName: string | null
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

interface WhatsAppResponsesModalProps {
  isOpen: boolean
  onClose: () => void
  absenceId: number
  personFirstName: string | null
  personLastName: string | null
  dateDebut: string
  dateFin: string
  creneau: string
  motif: string
  onResponseDeleted: () => void
}

export default function WhatsAppResponsesModal({
  isOpen,
  onClose,
  absenceId,
  personFirstName,
  personLastName,
  dateDebut,
  dateFin,
  creneau,
  motif,
  onResponseDeleted,
}: WhatsAppResponsesModalProps) {
  const [responses, setResponses] = useState<WhatsappResponseRow[]>([])
  const [loadingResponses, setLoadingResponses] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoadingResponses(true)
    fetch(`/api/whatsapp/responses?absenceId=${absenceId}`)
      .then(res => res.json())
      .then(data => setResponses(data.data || []))
      .catch(error => console.error('Error fetching responses:', error))
      .finally(() => setLoadingResponses(false))
  }, [isOpen, absenceId])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleDeleteResponse = async (messageId: number) => {
    if (!confirm('Supprimer cette réponse WhatsApp ?')) return

    try {
      const res = await fetch(`/api/whatsapp/responses/${messageId}`, { method: 'DELETE' })
      if (res.ok) {
        setResponses(prev => prev.filter(r => r.id !== messageId))
        onResponseDeleted()
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error deleting response:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-2xl">
        <div className="modal-header">
          <h3 className="text-lg font-semibold">Réponses WhatsApp</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
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

            {loadingResponses ? (
              <div className="flex items-center justify-center p-6">
                <span className="inline-block w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-sm text-gray-500">Chargement...</span>
              </div>
            ) : responses.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Aucun message WhatsApp envoyé pour cette absence.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  {responses.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        r.response === 'disponible' ? 'bg-green-500' :
                        r.response === 'pas_disponible' ? 'bg-red-500' :
                        'bg-yellow-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <Link
                            href={`/remplacants/${r.remplacantId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-gray-900 hover:text-purple-600"
                          >
                            {r.remplacantLastName?.toUpperCase()} {r.remplacantFirstName}
                          </Link>
                        </div>
                        <div className="text-xs text-gray-400">
                          {r.phone} • Envoyé {formatDateTime(r.createdAt)}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {r.response === 'disponible' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Disponible
                          </span>
                        ) : r.response === 'pas_disponible' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Indisponible
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            En attente
                          </span>
                        )}
                      </div>
                      {r.respondedAt && (
                        <div className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                          {formatDateTime(r.respondedAt)}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteResponse(r.id)}
                        className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <div></div>
          <div className="modal-footer-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
