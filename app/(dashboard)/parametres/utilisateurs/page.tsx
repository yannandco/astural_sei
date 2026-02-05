'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, UsersIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

export default function UtilisateursPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
  })

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', role: 'user' })
    setShowModal(true)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
    const method = editingUser ? 'PATCH' : 'POST'

    const payload: Record<string, string> = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
    }
    if (formData.password) {
      payload.password = formData.password
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowModal(false)
        fetchUsers()
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Error saving user:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet utilisateur ?')) return
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (res.ok) fetchUsers()
      else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const toggleActive = async (user: User) => {
    try {
      await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      fetchUsers()
    } catch (error) {
      console.error('Error toggling user:', error)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <UsersIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Utilisateurs</h1>
              <p className="ds-header-subtitle">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</p>
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
      ) : users.length === 0 ? (
        <div className="ds-empty-state">
          <div className="ds-empty-state-content">
            <div className="ds-empty-state-icon-wrapper">
              <UsersIcon className="ds-empty-state-icon" />
            </div>
            <h3 className="ds-empty-state-title">Aucun utilisateur</h3>
            <p className="ds-empty-state-text">Commencez par créer un utilisateur.</p>
          </div>
        </div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                <th className="ds-table-header-cell">Nom</th>
                <th className="ds-table-header-cell">Email</th>
                <th className="ds-table-header-cell">Rôle</th>
                <th className="ds-table-header-cell">Dernière connexion</th>
                <th className="ds-table-header-cell">Statut</th>
                <th className="ds-table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {users.map((user) => (
                <tr key={user.id} className="ds-table-row">
                  <td className="ds-table-cell font-medium text-gray-900">{user.name}</td>
                  <td className="ds-table-cell text-gray-500">{user.email}</td>
                  <td className="ds-table-cell">
                    <span className={user.role === 'admin' ? 'status-badge-purple' : 'status-badge-gray'}>
                      {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </span>
                  </td>
                  <td className="ds-table-cell text-gray-500 text-sm">{formatDate(user.lastLoginAt)}</td>
                  <td className="ds-table-cell">
                    <button onClick={() => toggleActive(user)} className={user.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="ds-table-cell text-right">
                    <button onClick={() => openEditModal(user)} className="text-gray-400 hover:text-purple-600 p-1 transition-colors">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="text-gray-400 hover:text-red-600 p-1 ml-2 transition-colors">
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
                <h3 className="modal-title">{editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h3>
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
                  <label className="form-label">Email *</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">{editingUser ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe *'}</label>
                  <input type="password" required={!editingUser} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rôle</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })} className="form-input">
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <div></div>
                <div className="modal-footer-actions">
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Annuler</button>
                  <button type="submit" className="btn btn-primary">{editingUser ? 'Enregistrer' : 'Créer'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
