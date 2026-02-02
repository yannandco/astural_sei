'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

interface ContactType {
  id: number
  name: string
  description: string | null
  color: string | null
  isActive: boolean
  sortOrder: number
}

export default function ParametresPage() {
  const [types, setTypes] = useState<ContactType[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState<ContactType | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    sortOrder: 0,
  })

  const fetchTypes = async () => {
    try {
      const res = await fetch('/api/contact-types')
      const data = await res.json()
      setTypes(data.data || [])
    } catch (error) {
      console.error('Error fetching types:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTypes()
  }, [])

  const openCreateModal = () => {
    setEditingType(null)
    setFormData({ name: '', description: '', color: '#3B82F6', sortOrder: 0 })
    setShowModal(true)
  }

  const openEditModal = (type: ContactType) => {
    setEditingType(type)
    setFormData({
      name: type.name,
      description: type.description || '',
      color: type.color || '#3B82F6',
      sortOrder: type.sortOrder,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingType ? `/api/contact-types/\${editingType.id}` : '/api/contact-types'
    const method = editingType ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowModal(false)
        fetchTypes()
      }
    } catch (error) {
      console.error('Error saving type:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce type de contact ?')) return
    try {
      const res = await fetch(`/api/contact-types/\${id}`, { method: 'DELETE' })
      if (res.ok) fetchTypes()
    } catch (error) {
      console.error('Error deleting type:', error)
    }
  }

  const toggleActive = async (type: ContactType) => {
    try {
      await fetch(`/api/contact-types/\${type.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !type.isActive }),
      })
      fetchTypes()
    } catch (error) {
      console.error('Error toggling type:', error)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Parametres</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Types de contact</h2>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
            <PlusIcon className="w-4 h-4" />
            Ajouter
          </button>
        </div>
        {loading ? (
          <p className="text-gray-500">Chargement...</p>
        ) : types.length === 0 ? (
          <p className="text-gray-500">Aucun type de contact</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th className="pb-2">Couleur</th>
                <th className="pb-2">Nom</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Ordre</th>
                <th className="pb-2">Actif</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: type.color || '#9CA3AF' }} />
                  </td>
                  <td className="py-3 font-medium">{type.name}</td>
                  <td className="py-3 text-gray-500 text-sm">{type.description || '-'}</td>
                  <td className="py-3 text-gray-500">{type.sortOrder}</td>
                  <td className="py-3">
                    <button onClick={() => toggleActive(type)} className={`px-2 py-1 rounded text-xs \${type.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {type.isActive ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => openEditModal(type)} className="text-gray-400 hover:text-blue-600 p-1">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(type.id)} className="text-gray-400 hover:text-red-600 p-1 ml-2">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">{editingType ? 'Modifier le type' : 'Nouveau type de contact'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" rows={2} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
                  <input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full h-10 rounded-md cursor-pointer" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordre</label>
                  <input type="number" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingType ? 'Enregistrer' : 'Creer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
