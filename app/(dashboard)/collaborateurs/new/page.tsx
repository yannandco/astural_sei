'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '@/components/ui'

interface Sector {
  id: number
  name: string
}

const emptyForm = {
  lastName: '',
  firstName: '',
  address: '',
  postalCode: '',
  city: '',
  mobilePro: '',
  email: '',
  secteurId: '',
  taux: '',
  contratType: '',
  contratDetails: '',
  canton: '',
  pays: '',
  sexe: '',
  dateSortie: '',
}

export default function CreateCollaborateurPage() {
  const router = useRouter()
  const [sectors, setSectors] = useState<Sector[]>([])
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetch('/api/sectors')
        const data = await res.json()
        setSectors(data.data || [])
      } catch (error) {
        console.error('Error fetching sectors:', error)
      }
    }
    fetchSectors()
  }, [])

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      ...formData,
      secteurId: formData.secteurId ? parseInt(formData.secteurId) : null,
      taux: formData.taux || null,
      contratType: formData.contratType || null,
      sexe: formData.sexe || null,
      dateSortie: formData.dateSortie || null,
    }

    try {
      const res = await fetch('/api/collaborateurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/collaborateurs/${data.data.id}`)
      }
    } catch (error) {
      console.error('Error creating collaborateur:', error)
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
              <UserPlusIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Nouveau collaborateur</h1>
              <p className="ds-header-subtitle">Créer une nouvelle fiche collaborateur</p>
            </div>
          </div>
          <Link href="/collaborateurs" className="btn btn-secondary">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Retour
          </Link>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10">
          {/* Left column */}
          <div className="space-y-4">
            {/* Identité */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Identité</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label">Nom *</label>
                    <input type="text" required value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prénom *</label>
                    <input type="text" required value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sexe</label>
                    <select value={formData.sexe} onChange={(e) => updateField('sexe', e.target.value)} className="form-input">
                      <option value="">-- Non renseigné --</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Contact</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile professionnel</label>
                    <input type="tel" value={formData.mobilePro} onChange={(e) => updateField('mobilePro', e.target.value)} className="form-input" />
                  </div>
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Adresse</h2>
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Adresse</label>
                    <input type="text" value={formData.address} onChange={(e) => updateField('address', e.target.value)} className="form-input" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="form-group">
                      <label className="form-label">Code postal</label>
                      <input type="text" value={formData.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ville</label>
                      <input type="text" value={formData.city} onChange={(e) => updateField('city', e.target.value)} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Canton</label>
                      <input type="text" value={formData.canton} onChange={(e) => updateField('canton', e.target.value)} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Pays</label>
                      <input type="text" value={formData.pays} onChange={(e) => updateField('pays', e.target.value)} className="form-input" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Contrat */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Contrat</h2>
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Secteur</label>
                    <select value={formData.secteurId} onChange={(e) => updateField('secteurId', e.target.value)} className="form-input">
                      <option value="">-- Aucun --</option>
                      {sectors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type de contrat</label>
                    <select value={formData.contratType} onChange={(e) => updateField('contratType', e.target.value)} className="form-input">
                      <option value="">-- Aucun --</option>
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="Mixte">Mixte</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Taux (%)</label>
                    <input type="number" step="0.01" min="0" max="100" value={formData.taux} onChange={(e) => updateField('taux', e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Détails contrat</label>
                    <textarea value={formData.contratDetails} onChange={(e) => updateField('contratDetails', e.target.value)} className="form-textarea" rows={2} />
                  </div>
                </div>
              </div>
            </div>

            {/* Statut */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Statut</h2>
                <div className="form-group">
                  <label className="form-label">Date de sortie</label>
                  <DatePicker value={formData.dateSortie} onChange={(value) => updateField('dateSortie', value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <Link href="/collaborateurs" className="btn btn-secondary">Annuler</Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
