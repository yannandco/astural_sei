'use client'

import { useState } from 'react'
import { ExclamationTriangleIcon, TrashIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

type ConfirmModal = {
  type: string
  message: string
} | null

type ResultModal = {
  success: boolean
  message: string
} | null

export default function SystemePage() {
  const [purging, setPurging] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>(null)
  const [resultModal, setResultModal] = useState<ResultModal>(null)

  const openConfirm = (type: string, message: string) => {
    setConfirmModal({ type, message })
  }

  const closeConfirm = () => {
    setConfirmModal(null)
  }

  const executePurge = async () => {
    if (!confirmModal) return

    const { type } = confirmModal

    // Si c'est "all", utiliser la fonction dédiée
    if (type === 'all') {
      executeAllPurge()
      return
    }

    closeConfirm()
    setPurging(type)

    try {
      const res = await fetch(`/api/system/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (res.ok) {
        setResultModal({ success: true, message: `${data.deleted} enregistrement(s) supprimé(s)` })
      } else {
        setResultModal({ success: false, message: `Erreur: ${data.error}` })
      }
    } catch (error) {
      console.error('Error purging:', error)
      setResultModal({ success: false, message: 'Erreur lors de la suppression' })
    } finally {
      setPurging(null)
    }
  }

  const executeAllPurge = async () => {
    closeConfirm()
    setPurging('all')

    const types = ['collaborateurs', 'remplacants', 'planning']
    let totalDeleted = 0
    let hasError = false

    for (const type of types) {
      try {
        const res = await fetch(`/api/system/purge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        })
        const data = await res.json()
        if (res.ok) {
          totalDeleted += data.deleted || 0
        } else {
          hasError = true
        }
      } catch (error) {
        console.error('Error purging:', error)
        hasError = true
      }
    }

    setPurging(null)
    if (hasError) {
      setResultModal({ success: false, message: `Suppression partielle: ${totalDeleted} enregistrement(s) supprimé(s)` })
    } else {
      setResultModal({ success: true, message: `${totalDeleted} enregistrement(s) supprimé(s) au total` })
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper bg-red-100">
              <ExclamationTriangleIcon className="ds-header-icon text-red-600" />
            </div>
            <div>
              <h1 className="ds-header-title">Système</h1>
              <p className="ds-header-subtitle">Actions de maintenance et suppression</p>
            </div>
          </div>
        </div>
      </div>

      {/* Purge Section */}
      <div className="ds-table-container p-5">
        <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-2">Suppression en masse</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ces actions sont irréversibles. Assurez-vous de faire une sauvegarde avant de procéder.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => openConfirm('collaborateurs', 'Supprimer TOUS les collaborateurs ? Cette action est irréversible.')}
            disabled={purging !== null}
            className="flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-700 transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Effacer tous les collaborateurs</span>
            {purging === 'collaborateurs' ? (
              <div className="spinner-sm"></div>
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => openConfirm('remplacants', 'Supprimer TOUS les remplaçants ? Cette action est irréversible.')}
            disabled={purging !== null}
            className="flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-700 transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Effacer tous les remplaçants</span>
            {purging === 'remplacants' ? (
              <div className="spinner-sm"></div>
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => openConfirm('etablissements', 'Supprimer TOUS les établissements et écoles ? Cette action est irréversible.')}
            disabled={purging !== null}
            className="flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-700 transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Effacer établissements et écoles</span>
            {purging === 'etablissements' ? (
              <div className="spinner-sm"></div>
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => openConfirm('directeurs-titulaires', 'Supprimer TOUS les directeurs et titulaires ? Cette action est irréversible.')}
            disabled={purging !== null}
            className="flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-700 transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Effacer directeurs et titulaires</span>
            {purging === 'directeurs-titulaires' ? (
              <div className="spinner-sm"></div>
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => openConfirm('planning', 'Supprimer TOUT le planning (établissements, écoles, directeurs, titulaires, affectations, taux) ? Cette action est irréversible.')}
            disabled={purging !== null}
            className="flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-700 transition-colors disabled:opacity-50 sm:col-span-2"
          >
            <span className="font-medium">Effacer tout le planning</span>
            {purging === 'planning' ? (
              <div className="spinner-sm"></div>
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Bouton Tout effacer */}
        <div className="mt-6 pt-4 border-t border-red-200">
          <button
            onClick={() => openConfirm('all', 'Supprimer TOUTES les données (collaborateurs, remplaçants, établissements, écoles, directeurs, titulaires, planning) ? Cette action est IRRÉVERSIBLE.')}
            disabled={purging !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-red-600 hover:bg-red-700 border border-red-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
          >
            {purging === 'all' ? (
              <>
                <div className="spinner-sm border-white border-t-transparent"></div>
                <span>Suppression en cours...</span>
              </>
            ) : (
              <>
                <TrashIcon className="w-5 h-5" />
                <span>Tout effacer</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de confirmation */}
      {confirmModal && (
        <div className="modal-overlay" onClick={closeConfirm}>
          <div className="modal-container max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
              </div>
              <button onClick={closeConfirm} className="text-gray-400 hover:text-gray-600 p-1">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-gray-700">{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button onClick={closeConfirm} className="btn btn-secondary">
                Annuler
              </button>
              <button onClick={executePurge} className="btn bg-red-600 text-white hover:bg-red-700">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de résultat */}
      {resultModal && (
        <div className="modal-overlay" onClick={() => setResultModal(null)}>
          <div className="modal-container max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${resultModal.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  {resultModal.success ? (
                    <CheckCircleIcon className="w-6 h-6 text-green-600" />
                  ) : (
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {resultModal.success ? 'Suppression effectuée' : 'Erreur'}
                </h3>
              </div>
              <button onClick={() => setResultModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-gray-700">{resultModal.message}</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setResultModal(null)} className="btn btn-primary">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
