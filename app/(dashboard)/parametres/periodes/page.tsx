'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, CalendarDaysIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'

interface PeriodeScolaire {
  id: number
  code: string
  label: string
  dateDebut: string
  dateFin: string
  isActive: boolean
}

export default function PeriodesPage() {
  const [periodes, setPeriodes] = useState<PeriodeScolaire[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPeriode, setEditingPeriode] = useState<PeriodeScolaire | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    dateDebut: '',
    dateFin: '',
  })
  const [error, setError] = useState<string | null>(null)

  const fetchPeriodes = async () => {
    try {
      const res = await fetch('/api/periodes-scolaires')
      const data = await res.json()
      setPeriodes(data.data || [])
    } catch (error) {
      console.error('Error fetching périodes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPeriodes()
  }, [])

  const openCreateModal = () => {
    setEditingPeriode(null)
    // Générer automatiquement le code basé sur l'année courante
    const currentYear = new Date().getFullYear()
    const yearCode = currentYear.toString().slice(-2)
    const nextYearCode = (currentYear + 1).toString().slice(-2)
    setFormData({
      code: `R${yearCode}`,
      label: `Période ${currentYear}/${currentYear + 1}`,
      dateDebut: `${currentYear}-08-01`,
      dateFin: `${currentYear + 1}-07-31`,
    })
    setError(null)
    setShowModal(true)
  }

  const openEditModal = (periode: PeriodeScolaire) => {
    setEditingPeriode(periode)
    setFormData({
      code: periode.code,
      label: periode.label,
      dateDebut: periode.dateDebut,
      dateFin: periode.dateFin,
    })
    setError(null)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation du code
    if (!/^R\d{2}$/.test(formData.code.toUpperCase())) {
      setError('Le code doit être au format RXX (ex: R25)')
      return
    }

    const url = editingPeriode
      ? `/api/periodes-scolaires/${editingPeriode.id}`
      : '/api/periodes-scolaires'
    const method = editingPeriode ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          code: formData.code.toUpperCase(),
        }),
      })

      if (res.ok) {
        setShowModal(false)
        fetchPeriodes()
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur lors de l\'enregistrement')
      }
    } catch (error) {
      console.error('Error saving période:', error)
      setError('Erreur lors de l\'enregistrement')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette période scolaire ?')) return
    try {
      const res = await fetch(`/api/periodes-scolaires/${id}`, { method: 'DELETE' })
      if (res.ok) fetchPeriodes()
    } catch (error) {
      console.error('Error deleting période:', error)
    }
  }

  const toggleActive = async (periode: PeriodeScolaire) => {
    try {
      await fetch(`/api/periodes-scolaires/${periode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !periode.isActive }),
      })
      fetchPeriodes()
    } catch (error) {
      console.error('Error toggling période:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <CalendarDaysIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Périodes scolaires</h1>
              <p className="ds-header-subtitle">{periodes.length} période{periodes.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={openCreateModal} className="btn btn-primary">
            <PlusIcon className="w-4 h-4 mr-2" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="ds-empty-state">
          <div className="ds-empty-state-content">
            <div className="spinner-md mx-auto mb-4"></div>
            <p className="text-gray-500">Chargement...</p>
          </div>
        </div>
      ) : periodes.length === 0 ? (
        <div className="ds-empty-state">
          <div className="ds-empty-state-content">
            <div className="ds-empty-state-icon-wrapper">
              <CalendarDaysIcon className="ds-empty-state-icon" />
            </div>
            <h3 className="ds-empty-state-title">Aucune période</h3>
            <p className="ds-empty-state-text">Commencez par créer une période scolaire (ex: R25 pour 2025/2026).</p>
          </div>
        </div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                <th className="ds-table-header-cell">Code</th>
                <th className="ds-table-header-cell">Libellé</th>
                <th className="ds-table-header-cell">Date début</th>
                <th className="ds-table-header-cell">Date fin</th>
                <th className="ds-table-header-cell">Statut</th>
                <th className="ds-table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {periodes.map((periode) => (
                <tr key={periode.id} className="ds-table-row">
                  <td className="ds-table-cell">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {periode.code}
                    </span>
                  </td>
                  <td className="ds-table-cell font-medium text-gray-900">{periode.label}</td>
                  <td className="ds-table-cell text-gray-500">{formatDate(periode.dateDebut)}</td>
                  <td className="ds-table-cell text-gray-500">{formatDate(periode.dateFin)}</td>
                  <td className="ds-table-cell">
                    <button
                      onClick={() => toggleActive(periode)}
                      className={periode.isActive ? 'status-badge-success' : 'status-badge-gray'}
                    >
                      {periode.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="ds-table-cell text-right">
                    <button
                      onClick={() => openEditModal(periode)}
                      className="text-gray-400 hover:text-purple-600 p-1 transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(periode.id)}
                      className="text-gray-400 hover:text-red-600 p-1 ml-2 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <div className="modal-header-content">
                <h3 className="modal-title">
                  {editingPeriode ? 'Modifier la période' : 'Nouvelle période scolaire'}
                </h3>
                <button onClick={() => setShowModal(false)} className="modal-close-button">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {error}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="form-input"
                    placeholder="R25"
                    maxLength={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: RXX (ex: R25 pour 2025/2026)</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Libellé *</label>
                  <input
                    type="text"
                    required
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="form-input"
                    placeholder="Période 2025/2026"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Date début *</label>
                    <DatePicker
                      value={formData.dateDebut}
                      onChange={(value) => setFormData({ ...formData, dateDebut: value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date fin *</label>
                    <DatePicker
                      value={formData.dateFin}
                      onChange={(value) => setFormData({ ...formData, dateFin: value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <div></div>
                <div className="modal-footer-actions">
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingPeriode ? 'Enregistrer' : 'Créer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
