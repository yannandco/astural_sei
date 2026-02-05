'use client'

import { useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, CalendarIcon } from '@heroicons/react/24/outline'
import {
  JourSemaine,
  Creneau,
  JOURS_SEMAINE,
  JOUR_LABELS,
  DisponibilitePeriode,
} from './types'
import PeriodeModal from './PeriodeModal'

interface RecurringAvailabilityEditorProps {
  remplacantId: number
  periodes: DisponibilitePeriode[]
  onCreatePeriode: (data: {
    nom: string
    dateDebut: string
    dateFin: string
    recurrences: { jourSemaine: JourSemaine; creneau: Creneau }[]
  }) => Promise<void>
  onUpdatePeriode: (data: {
    id: number
    nom: string
    dateDebut: string
    dateFin: string
    recurrences: { jourSemaine: JourSemaine; creneau: Creneau }[]
  }) => Promise<void>
  onDeletePeriode: (periodeId: number) => Promise<void>
  readOnly?: boolean
}

export default function RecurringAvailabilityEditor({
  remplacantId,
  periodes,
  onCreatePeriode,
  onUpdatePeriode,
  onDeletePeriode,
  readOnly = false,
}: RecurringAvailabilityEditorProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPeriode, setEditingPeriode] = useState<DisponibilitePeriode | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const handleOpenCreate = () => {
    setEditingPeriode(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (periode: DisponibilitePeriode) => {
    setEditingPeriode(periode)
    setModalOpen(true)
  }

  const handleSave = async (data: {
    id?: number
    nom: string
    dateDebut: string
    dateFin: string
    recurrences: { jourSemaine: JourSemaine; creneau: Creneau }[]
  }) => {
    try {
      if (data.id) {
        await onUpdatePeriode(data as { id: number; nom: string; dateDebut: string; dateFin: string; recurrences: { jourSemaine: JourSemaine; creneau: Creneau }[] })
      } else {
        await onCreatePeriode(data)
      }
      // Fermer le modal uniquement après succès
      setModalOpen(false)
    } catch (err) {
      // Propager l'erreur pour que PeriodeModal l'affiche
      throw err
    }
  }

  const handleDelete = async (periodeId: number) => {
    if (!confirm('Supprimer cette période et toutes ses récurrences ?')) return
    setDeletingId(periodeId)
    try {
      await onDeletePeriode(periodeId)
    } finally {
      setDeletingId(null)
    }
  }

  const getRecurrencesSummary = (periode: DisponibilitePeriode): string => {
    if (periode.recurrences.length === 0) return 'Aucune récurrence'

    const summary: string[] = []

    for (const jour of JOURS_SEMAINE) {
      const creneauxJour = periode.recurrences
        .filter((r) => r.jourSemaine === jour)
        .map((r) => r.creneau)

      if (creneauxJour.length === 2 || creneauxJour.includes('journee')) {
        summary.push(JOUR_LABELS[jour])
      } else if (creneauxJour.includes('matin')) {
        summary.push(`${JOUR_LABELS[jour]} (mat.)`)
      } else if (creneauxJour.includes('apres_midi')) {
        summary.push(`${JOUR_LABELS[jour]} (ap.)`)
      }
    }

    return summary.length > 0 ? summary.join(', ') : 'Aucune récurrence'
  }

  const isPeriodeActive = (periode: DisponibilitePeriode): boolean => {
    const today = new Date().toISOString().split('T')[0]
    return periode.isActive && today >= periode.dateDebut && today <= periode.dateFin
  }

  return (
    <div className="space-y-3">
      {/* Liste des périodes */}
      {periodes.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <CalendarIcon className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Aucune période de disponibilité</p>
          {!readOnly && (
            <button
              onClick={handleOpenCreate}
              className="mt-3 btn btn-primary text-sm"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Ajouter une période
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {periodes.map((periode) => {
            const isActive = isPeriodeActive(periode)
            const isDeleting = deletingId === periode.id

            return (
              <div
                key={periode.id}
                className={`border rounded-lg p-3 ${
                  isActive ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                } ${isDeleting ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">
                        Du {formatDateDisplay(periode.dateDebut)} au {formatDateDisplay(periode.dateFin)}
                      </p>
                      {isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {getRecurrencesSummary(periode)}
                    </p>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(periode)}
                        disabled={isDeleting}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                        title="Modifier"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(periode.id)}
                        disabled={isDeleting}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Supprimer"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {!readOnly && (
            <button
              onClick={handleOpenCreate}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors flex items-center justify-center gap-1"
            >
              <PlusIcon className="h-4 w-4" />
              Ajouter une période
            </button>
          )}
        </div>
      )}

      {/* Modal de création/édition */}
      <PeriodeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        periode={editingPeriode}
      />
    </div>
  )
}
