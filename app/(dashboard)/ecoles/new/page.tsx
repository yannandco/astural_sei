'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, AcademicCapIcon } from '@heroicons/react/24/outline'
import { PhoneInput } from '@/components/ui'

interface Etablissement {
  id: number
  name: string
}

const emptyForm = { name: '', etablissementId: '', rue: '', codePostal: '', ville: '', phone: '', email: '' }

export default function CreateEcolePage() {
  const router = useRouter()
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchEtablissements = async () => {
      try {
        const res = await fetch('/api/etablissements')
        const data = await res.json()
        setEtablissements(data.data || [])
      } catch (error) {
        console.error('Error fetching etablissements:', error)
      }
    }
    fetchEtablissements()
  }, [])

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch('/api/ecoles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          etablissementId: formData.etablissementId ? parseInt(formData.etablissementId) : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/ecoles/${data.data.id}`)
      }
    } catch (error) {
      console.error('Error creating ecole:', error)
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
              <AcademicCapIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Nouvelle école</h1>
              <p className="ds-header-subtitle">Créer une nouvelle école</p>
            </div>
          </div>
          <Link href="/ecoles" className="btn btn-secondary">
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
                <label className="form-label">Établissement *</label>
                <select required value={formData.etablissementId} onChange={(e) => updateField('etablissementId', e.target.value)} className="form-input">
                  <option value="">-- Sélectionner --</option>
                  {etablissements.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rue</label>
                <input type="text" value={formData.rue} onChange={(e) => updateField('rue', e.target.value)} className="form-input" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Code postal</label>
                  <input type="text" value={formData.codePostal} onChange={(e) => updateField('codePostal', e.target.value)} className="form-input" maxLength={10} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ville</label>
                  <input type="text" value={formData.ville} onChange={(e) => updateField('ville', e.target.value)} className="form-input" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <PhoneInput value={formData.phone} onChange={(value) => updateField('phone', value)} />
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
          <Link href="/ecoles" className="btn btn-secondary">Annuler</Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
