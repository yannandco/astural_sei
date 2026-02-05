'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, SwatchIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Sector {
  id: number
  name: string
  description: string | null
  color: string | null
  isActive: boolean
  sortOrder: number
}

// Palette de couleurs prédéfinies pour les secteurs
const COLOR_PALETTE = [
  '#3C1558', // Violet Astural
  '#7C3AED', // Violet clair
  '#2563EB', // Bleu
  '#0891B2', // Cyan
  '#059669', // Vert
  '#65A30D', // Vert lime
  '#CA8A04', // Jaune
  '#EA580C', // Orange
  '#DC2626', // Rouge
  '#DB2777', // Rose
  '#9333EA', // Pourpre
  '#6366F1', // Indigo
  '#0EA5E9', // Bleu ciel
  '#14B8A6', // Teal
  '#22C55E', // Vert émeraude
  '#84CC16', // Lime
  '#EAB308', // Jaune vif
  '#F97316', // Orange vif
  '#EF4444', // Rouge vif
  '#EC4899', // Rose vif
]

export default function SecteursPage() {
  const [sectorsList, setSectorsList] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSector, setEditingSector] = useState<Sector | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3C1558',
    sortOrder: 0,
  })

  const fetchSectors = async () => {
    try {
      const res = await fetch('/api/sectors')
      const data = await res.json()
      setSectorsList(data.data || [])
    } catch (error) {
      console.error('Error fetching sectors:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSectors()
  }, [])

  const openCreateModal = () => {
    setEditingSector(null)
    setFormData({ name: '', description: '', color: '#3C1558', sortOrder: 0 })
    setShowModal(true)
  }

  const openEditModal = (sector: Sector) => {
    setEditingSector(sector)
    setFormData({
      name: sector.name,
      description: sector.description || '',
      color: sector.color || '#3C1558',
      sortOrder: sector.sortOrder,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingSector ? `/api/sectors/${editingSector.id}` : '/api/sectors'
    const method = editingSector ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowModal(false)
        fetchSectors()
      }
    } catch (error) {
      console.error('Error saving sector:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce secteur ?')) return
    try {
      const res = await fetch(`/api/sectors/${id}`, { method: 'DELETE' })
      if (res.ok) fetchSectors()
    } catch (error) {
      console.error('Error deleting sector:', error)
    }
  }

  const toggleActive = async (sector: Sector) => {
    try {
      await fetch(`/api/sectors/${sector.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !sector.isActive }),
      })
      fetchSectors()
    } catch (error) {
      console.error('Error toggling sector:', error)
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <SwatchIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Secteurs</h1>
              <p className="ds-header-subtitle">{sectorsList.length} secteur{sectorsList.length !== 1 ? 's' : ''}</p>
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
      ) : sectorsList.length === 0 ? (
        <div className="ds-empty-state">
          <div className="ds-empty-state-content">
            <div className="ds-empty-state-icon-wrapper">
              <SwatchIcon className="ds-empty-state-icon" />
            </div>
            <h3 className="ds-empty-state-title">Aucun secteur</h3>
            <p className="ds-empty-state-text">Commencez par créer un secteur.</p>
          </div>
        </div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                <th className="ds-table-header-cell">Couleur</th>
                <th className="ds-table-header-cell">Nom</th>
                <th className="ds-table-header-cell">Description</th>
                <th className="ds-table-header-cell">Ordre</th>
                <th className="ds-table-header-cell">Statut</th>
                <th className="ds-table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {sectorsList.map((sector) => (
                <tr key={sector.id} className="ds-table-row">
                  <td className="ds-table-cell">
                    <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: sector.color || '#9CA3AF' }} />
                  </td>
                  <td className="ds-table-cell font-medium text-gray-900">{sector.name}</td>
                  <td className="ds-table-cell text-gray-500">{sector.description || '-'}</td>
                  <td className="ds-table-cell text-gray-500">{sector.sortOrder}</td>
                  <td className="ds-table-cell">
                    <button onClick={() => toggleActive(sector)} className={sector.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                      {sector.isActive ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="ds-table-cell text-right">
                    <button onClick={() => openEditModal(sector)} className="text-gray-400 hover:text-purple-600 p-1 transition-colors">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(sector.id)} className="text-gray-400 hover:text-red-600 p-1 ml-2 transition-colors">
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
                <h3 className="modal-title">{editingSector ? 'Modifier le secteur' : 'Nouveau secteur'}</h3>
                <button onClick={() => setShowModal(false)} className="modal-close-button">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label className="form-label">Nom *</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="form-textarea" rows={2} />
                </div>
                <div className="form-group">
                  <label className="form-label">Couleur</label>
                  <div className="grid grid-cols-10 gap-2 mt-2">
                    {COLOR_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-7 h-7 rounded-full transition-all ${
                          formData.color === color
                            ? 'ring-2 ring-offset-2 ring-purple-500 scale-110'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ordre d&apos;affichage</label>
                  <input type="number" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} className="form-input" />
                </div>
              </div>
              <div className="modal-footer">
                <div></div>
                <div className="modal-footer-actions">
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Annuler</button>
                  <button type="submit" className="btn btn-primary">{editingSector ? 'Enregistrer' : 'Créer'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
