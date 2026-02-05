'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline'

const emptyForm = {
  name: '',
  address: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
}

export default function CreateEtablissementPage() {
  const router = useRouter()
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch('/api/etablissements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/etablissements/${data.data.id}`)
      }
    } catch (error) {
      console.error('Error creating etablissement:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <BuildingOffice2Icon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Nouvel établissement</h1>
              <p className="ds-header-subtitle">Créer un nouvel établissement</p>
            </div>
          </div>
          <Link href="/etablissements" className="btn btn-secondary">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Retour
          </Link>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="ds-table-container">
          <div className="p-5">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Informations</h2>
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input type="text" required value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Adresse</label>
                <input type="text" value={formData.address} onChange={(e) => updateField('address', e.target.value)} className="form-input" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Code postal</label>
                  <input type="text" value={formData.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Ville</label>
                  <input type="text" value={formData.city} onChange={(e) => updateField('city', e.target.value)} className="form-input" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="form-input" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <Link href="/etablissements" className="btn btn-secondary">Annuler</Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
