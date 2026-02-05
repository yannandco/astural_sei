'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, BuildingOffice2Icon, TrashIcon, PlusIcon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline'

interface Ecole {
  id: number
  name: string
  directeurId: number | null
  directeurLastName: string | null
  directeurFirstName: string | null
  etabDirecteurLastName: string | null
  etabDirecteurFirstName: string | null
  isActive: boolean
}

interface EcoleOption {
  id: number
  name: string
  etablissementName: string | null
}

interface Directeur {
  id: number
  lastName: string
  firstName: string
}

export default function EtablissementDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [ecoles, setEcoles] = useState<Ecole[]>([])
  const [directeurs, setDirecteurs] = useState<Directeur[]>([])
  const [showAddEcole, setShowAddEcole] = useState(false)
  const [addMode, setAddMode] = useState<'create' | 'assign'>('create')
  const [ecoleForm, setEcoleForm] = useState({ name: '', address: '', phone: '', email: '' })
  const [availableEcoles, setAvailableEcoles] = useState<EcoleOption[]>([])
  const [selectedEcoleId, setSelectedEcoleId] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    postalCode: '',
    city: '',
    phone: '',
    email: '',
    directeurId: '' as string | number,
    isActive: true,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [etabRes, directeursRes] = await Promise.all([
          fetch(`/api/etablissements/${id}`),
          fetch('/api/directeurs'),
        ])

        if (!etabRes.ok) {
          router.push('/etablissements')
          return
        }

        const data = await etabRes.json()
        const e = data.data
        setFormData({
          name: e.name,
          address: e.address || '',
          postalCode: e.postalCode || '',
          city: e.city || '',
          phone: e.phone || '',
          email: e.email || '',
          directeurId: e.directeurId || '',
          isActive: e.isActive,
        })

        const directeursData = await directeursRes.json()
        setDirecteurs(directeursData.data || [])

        await fetchEcoles()
      } catch (error) {
        console.error('Error fetching etablissement:', error)
        router.push('/etablissements')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, router])

  const fetchEcoles = async () => {
    const ecolesRes = await fetch(`/api/ecoles?etablissementId=${id}`)
    const ecolesData = await ecolesRes.json()
    setEcoles(ecolesData.data || [])
  }

  const fetchAvailableEcoles = async () => {
    const res = await fetch('/api/ecoles?available=true')
    const data = await res.json()
    setAvailableEcoles(data.data || [])
  }

  const updateField = (field: string, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddEcole = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/ecoles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ecoleForm, etablissementId: parseInt(id) }),
      })
      if (res.ok) {
        setShowAddEcole(false)
        setEcoleForm({ name: '', address: '', phone: '', email: '' })
        fetchEcoles()
      }
    } catch (error) {
      console.error('Error creating ecole:', error)
    }
  }

  const handleAssignEcole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEcoleId) return
    try {
      const res = await fetch(`/api/ecoles/${selectedEcoleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etablissementId: parseInt(id) }),
      })
      if (res.ok) {
        setShowAddEcole(false)
        setSelectedEcoleId('')
        fetchEcoles()
      }
    } catch (error) {
      console.error('Error assigning ecole:', error)
    }
  }

  const openAddModal = () => {
    setAddMode('create')
    setEcoleForm({ name: '', address: '', phone: '', email: '' })
    setSelectedEcoleId('')
    fetchAvailableEcoles()
    setShowAddEcole(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...formData,
        directeurId: formData.directeurId ? parseInt(formData.directeurId.toString()) : null,
      }
      const res = await fetch(`/api/etablissements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) setIsEditMode(false)
    } catch (error) {
      console.error('Error saving etablissement:', error)
    } finally {
      setSaving(false)
    }
  }

  const getDirecteurName = () => {
    if (!formData.directeurId) return '-'
    const directeur = directeurs.find(d => d.id.toString() === formData.directeurId.toString())
    return directeur ? `${directeur.firstName} ${directeur.lastName}` : '-'
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer cet établissement et toutes ses écoles ?')) return
    try {
      const res = await fetch(`/api/etablissements/${id}`, { method: 'DELETE' })
      if (res.ok) router.push('/etablissements')
    } catch (error) {
      console.error('Error deleting etablissement:', error)
    }
  }

  if (loading) {
    return (
      <div className="ds-empty-state">
        <div className="ds-empty-state-content">
          <div className="spinner-md mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <BuildingOffice2Icon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">{formData.name}</h1>
              <p className="ds-header-subtitle">Fiche établissement</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/etablissements" className="btn btn-secondary">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Retour
            </Link>
            {!isEditMode && (
              <button onClick={() => setIsEditMode(true)} className="btn btn-primary">
                <PencilIcon className="w-4 h-4 mr-2" />
                Modifier
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10">
          {/* Left column */}
          <div className="space-y-4">
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Informations</h2>
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Nom {isEditMode && '*'}</label>
                    {isEditMode ? (
                      <input type="text" required value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="form-input" />
                    ) : (
                      <div className="py-2 text-gray-900">{formData.name || '-'}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Adresse</label>
                    {isEditMode ? (
                      <input type="text" value={formData.address} onChange={(e) => updateField('address', e.target.value)} className="form-input" />
                    ) : (
                      <div className="py-2 text-gray-900">{formData.address || '-'}</div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Code postal</label>
                      {isEditMode ? (
                        <input type="text" value={formData.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-2 text-gray-900">{formData.postalCode || '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ville</label>
                      {isEditMode ? (
                        <input type="text" value={formData.city} onChange={(e) => updateField('city', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-2 text-gray-900">{formData.city || '-'}</div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Téléphone</label>
                      {isEditMode ? (
                        <input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-2 text-gray-900">{formData.phone || '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      {isEditMode ? (
                        <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-2 text-gray-900">{formData.email || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ecoles section */}
            <div className="ds-table-container">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider">Écoles ({ecoles.length})</h2>
                  <button type="button" onClick={openAddModal} className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1">
                    <PlusIcon className="w-4 h-4" /> Ajouter
                  </button>
                </div>
                {ecoles.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune école rattachée.</p>
                ) : (
                  <table className="ds-table">
                    <thead className="ds-table-header">
                      <tr>
                        <th className="ds-table-header-cell">Nom</th>
                        <th className="ds-table-header-cell">Directeur</th>
                        <th className="ds-table-header-cell">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="ds-table-body">
                      {ecoles.map((ecole) => (
                        <tr
                          key={ecole.id}
                          className="ds-table-row cursor-pointer hover:bg-purple-50 transition-colors"
                          onClick={() => router.push(`/ecoles/${ecole.id}`)}
                        >
                          <td className="ds-table-cell font-medium text-gray-900">{ecole.name}</td>
                          <td className="ds-table-cell text-gray-500">
                            {ecole.directeurId ? (
                              // École has its own director (override)
                              <span>{ecole.directeurFirstName} {ecole.directeurLastName}</span>
                            ) : ecole.etabDirecteurFirstName && ecole.etabDirecteurLastName ? (
                              // Inherited from établissement
                              <span className="text-gray-400 italic">
                                {ecole.etabDirecteurFirstName} {ecole.etabDirecteurLastName}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="ds-table-cell">
                            <span className={ecole.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                              {ecole.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Directeur</h2>
                <div className="form-group">
                  <label className="form-label">Directeur de l'établissement</label>
                  {isEditMode ? (
                    <>
                      <select
                        value={formData.directeurId}
                        onChange={(e) => updateField('directeurId', e.target.value)}
                        className="form-input"
                      >
                        <option value="">-- Aucun directeur --</option>
                        {directeurs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.firstName} {d.lastName}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Ce directeur sera automatiquement assigné à toutes les écoles de cet établissement (sauf override).
                      </p>
                    </>
                  ) : (
                    <div className="py-2 text-gray-900">{getDirecteurName()}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Statut</h2>
                <div className="form-group">
                  <label className="form-label">Actif</label>
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() => updateField('isActive', !formData.isActive)}
                      className={formData.isActive ? 'status-badge-success' : 'status-badge-gray'}
                    >
                      {formData.isActive ? 'Actif' : 'Inactif'}
                    </button>
                  ) : (
                    <span className={formData.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                      {formData.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {isEditMode && (
          <div className="flex justify-between items-center mt-4">
            <button type="button" onClick={handleDelete} className="text-gray-400 hover:text-red-600 p-2 transition-colors" title="Supprimer">
              <TrashIcon className="w-5 h-5" />
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsEditMode(false)} className="btn btn-secondary">Annuler</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Add Ecole Modal */}
      {showAddEcole && (
        <div className="modal-overlay">
          <div className="modal-container max-w-lg">
            <div className="modal-header">
              <div className="modal-header-content">
                <h3 className="modal-title">Ajouter une école</h3>
                <button onClick={() => setShowAddEcole(false)} className="modal-close-button"><XMarkIcon className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setAddMode('create')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  addMode === 'create'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Créer une nouvelle
              </button>
              <button
                type="button"
                onClick={() => setAddMode('assign')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  addMode === 'assign'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Assigner une existante
              </button>
            </div>

            {addMode === 'create' ? (
              <form onSubmit={handleAddEcole}>
                <div className="modal-body space-y-4">
                  <div className="form-group">
                    <label className="form-label">Nom *</label>
                    <input type="text" required value={ecoleForm.name} onChange={(e) => setEcoleForm(prev => ({ ...prev, name: e.target.value }))} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Adresse</label>
                    <input type="text" value={ecoleForm.address} onChange={(e) => setEcoleForm(prev => ({ ...prev, address: e.target.value }))} className="form-input" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Téléphone</label>
                      <input type="tel" value={ecoleForm.phone} onChange={(e) => setEcoleForm(prev => ({ ...prev, phone: e.target.value }))} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" value={ecoleForm.email} onChange={(e) => setEcoleForm(prev => ({ ...prev, email: e.target.value }))} className="form-input" />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <div></div>
                  <div className="modal-footer-actions">
                    <button type="button" onClick={() => setShowAddEcole(false)} className="btn btn-secondary">Annuler</button>
                    <button type="submit" className="btn btn-primary">Créer</button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAssignEcole}>
                <div className="modal-body space-y-4">
                  <div className="form-group">
                    <label className="form-label">Sélectionner une école *</label>
                    <select
                      required
                      value={selectedEcoleId}
                      onChange={(e) => setSelectedEcoleId(e.target.value)}
                      className="form-input"
                    >
                      <option value="">-- Choisir une école --</option>
                      {availableEcoles.map((ecole) => (
                        <option key={ecole.id} value={ecole.id}>
                          {ecole.name}
                          {ecole.etablissementName ? ` (${ecole.etablissementName})` : ' (sans établissement)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  {availableEcoles.length === 0 && (
                    <p className="text-sm text-gray-500">Aucune école disponible à assigner.</p>
                  )}
                </div>
                <div className="modal-footer">
                  <div></div>
                  <div className="modal-footer-actions">
                    <button type="button" onClick={() => setShowAddEcole(false)} className="btn btn-secondary">Annuler</button>
                    <button type="submit" disabled={!selectedEcoleId} className="btn btn-primary">Assigner</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
