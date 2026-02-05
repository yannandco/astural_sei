'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

interface Backup {
  filename: string
  date: string
  name: string
  size: number
  sizeFormatted: string
  compressed: boolean
  createdAt: string
}

export default function BackupPage() {
  const router = useRouter()
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [backupName, setBackupName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch('/api/backup')
      const data = await res.json()
      if (res.ok) {
        setBackups(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching backups:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  const handleCreate = async () => {
    setCreating(true)
    setMessage(null)

    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: backupName, compress: true }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: `Sauvegarde créée: ${data.data.filename}` })
        setBackupName('')
        setShowCreateModal(false)
        fetchBackups()
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de la création' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la création' })
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (filename: string) => {
    setRestoring(filename)
    setMessage(null)
    setShowRestoreConfirm(null)

    try {
      const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        // Redirect to login after successful restore (session is invalidated)
        setMessage({ type: 'success', text: 'Restauration effectuée avec succès. Redirection vers la page de connexion...' })
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de la restauration' })
        setRestoring(null)
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la restauration' })
      setRestoring(null)
    }
  }

  const handleDelete = async (filename: string) => {
    setDeleting(filename)
    setMessage(null)
    setShowDeleteConfirm(null)

    try {
      const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'Sauvegarde supprimée' })
        fetchBackups()
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de la suppression' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la suppression' })
    } finally {
      setDeleting(null)
    }
  }

  const handleDownload = (filename: string) => {
    window.open(`/api/backup/${encodeURIComponent(filename)}`, '_blank')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <ServerStackIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Sauvegardes</h1>
              <p className="ds-header-subtitle">Gérer les sauvegardes de la base de données</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Nouvelle sauvegarde
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircleIcon className="w-5 h-5" />
          ) : (
            <ExclamationTriangleIcon className="w-5 h-5" />
          )}
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-sm underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Warning */}
      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <strong>Attention :</strong> La restauration d&apos;une sauvegarde remplacera toutes les données actuelles.
          Assurez-vous de créer une nouvelle sauvegarde avant de restaurer une ancienne version.
        </div>
      </div>

      {/* Backups List */}
      <div className="ds-table-container">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center">
            <ServerStackIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucune sauvegarde disponible</p>
            <p className="text-sm text-gray-400 mt-1">Créez votre première sauvegarde</p>
          </div>
        ) : (
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                <th className="ds-table-header-cell">Date</th>
                <th className="ds-table-header-cell">Nom</th>
                <th className="ds-table-header-cell">Taille</th>
                <th className="ds-table-header-cell">Format</th>
                <th className="ds-table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {backups.map((backup) => (
                <tr key={backup.filename} className="ds-table-row">
                  <td className="ds-table-cell font-medium">
                    {formatDate(backup.createdAt)}
                  </td>
                  <td className="ds-table-cell text-gray-500">
                    {backup.name || <span className="italic">Sans nom</span>}
                  </td>
                  <td className="ds-table-cell text-gray-500">
                    {backup.sizeFormatted}
                  </td>
                  <td className="ds-table-cell">
                    <span className={`text-xs px-2 py-1 rounded ${
                      backup.compressed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {backup.compressed ? 'Compressé' : 'SQL'}
                    </span>
                  </td>
                  <td className="ds-table-cell">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleDownload(backup.filename)}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="Télécharger"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowRestoreConfirm(backup.filename)}
                        disabled={restoring === backup.filename}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                        title="Restaurer"
                      >
                        <ArrowPathIcon className={`w-4 h-4 ${restoring === backup.filename ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(backup.filename)}
                        disabled={deleting === backup.filename}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nouvelle sauvegarde</h2>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nom (optionnel)</label>
                <input
                  type="text"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder="Ex: avant-migration"
                  className="form-input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Un nom pour identifier facilement cette sauvegarde
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn btn-primary"
              >
                {creating ? 'Création...' : 'Créer la sauvegarde'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirm Modal */}
      {showRestoreConfirm && (
        <div className="modal-overlay" onClick={() => setShowRestoreConfirm(null)}>
          <div className="modal-container max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title text-red-700">Confirmer la restauration</h2>
            </div>
            <div className="modal-body">
              <div className="p-4 bg-red-50 rounded-lg mb-4">
                <p className="text-sm text-red-800">
                  <strong>Attention !</strong> Cette action va remplacer toutes les données actuelles
                  par celles de la sauvegarde sélectionnée.
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Fichier : <strong>{showRestoreConfirm}</strong>
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowRestoreConfirm(null)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={() => handleRestore(showRestoreConfirm)}
                className="btn bg-red-600 text-white hover:bg-red-700"
              >
                Restaurer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-container max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Supprimer la sauvegarde</h2>
            </div>
            <div className="modal-body">
              <p className="text-sm text-gray-600">
                Êtes-vous sûr de vouloir supprimer cette sauvegarde ?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Fichier : <strong>{showDeleteConfirm}</strong>
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="btn bg-red-600 text-white hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
