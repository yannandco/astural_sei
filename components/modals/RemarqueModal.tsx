'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface RemarqueModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (texte: string) => Promise<void>
}

export default function RemarqueModal({ isOpen, onClose, onSubmit }: RemarqueModalProps) {
  const [newRemarque, setNewRemarque] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) setNewRemarque('')
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRemarque.trim()) return
    setSaving(true)
    try {
      await onSubmit(newRemarque)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg">
        <div className="modal-header">
          <h3 className="text-lg font-semibold">Nouvelle remarque</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Remarque *</label>
              <textarea
                required
                value={newRemarque}
                onChange={(e) => setNewRemarque(e.target.value)}
                className="form-input"
                rows={4}
                placeholder="Saisissez votre remarque..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <div></div>
            <div className="modal-footer-actions">
              <button type="button" onClick={onClose} className="btn btn-secondary">Annuler</button>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Ajout...' : 'Ajouter'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
