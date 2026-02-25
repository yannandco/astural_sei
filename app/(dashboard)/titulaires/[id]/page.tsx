'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, UserIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import { PhoneInput } from '@/components/ui'

interface Intervenant { collaborateurId: number; firstName: string; lastName: string }
interface Affectation { id: number; ecoleId: number; classeId: number | null; dateDebut: string | null; dateFin: string | null; isActive: boolean; ecoleName: string | null; classeName: string | null; intervenants: Intervenant[] }
interface Remplacement { id: number; affectationId: number; titulaireOriginalId: number; remplacantTitulaireId: number; dateDebut: string; dateFin: string | null; motif: string | null }

export default function TitulaireDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [remplacements, setRemplacements] = useState<Remplacement[]>([])
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    email: '',
    phone: '',
    isActive: true,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/titulaires/${id}`)
        if (!res.ok) { router.push('/titulaires'); return }
        const data = await res.json()
        const t = data.data
        setFormData({
          lastName: t.lastName,
          firstName: t.firstName,
          email: t.email || '',
          phone: t.phone || '',
          isActive: t.isActive,
        })
        setAffectations(t.affectations || [])
        setRemplacements(t.remplacements || [])
      } catch (error) {
        console.error('Error:', error)
        router.push('/titulaires')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, router])

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/titulaires/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) setIsEditMode(false)
    } catch (error) {
      console.error('Error saving titulaire:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce titulaire ?')) return
    try {
      const res = await fetch(`/api/titulaires/${id}`, { method: 'DELETE' })
      if (res.ok) router.push('/titulaires')
    } catch (error) {
      console.error('Error deleting titulaire:', error)
    }
  }

  if (loading) {
    return (
      <div className="ds-empty-state"><div className="ds-empty-state-content"><div className="spinner-md mx-auto mb-4"></div><p className="text-gray-500">Chargement...</p></div></div>
    )
  }

  return (
    <div>
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper"><UserIcon className="ds-header-icon" /></div>
            <div>
              <h1 className="ds-header-title">{formData.firstName} {formData.lastName}</h1>
              <p className="ds-header-subtitle">Fiche titulaire</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/titulaires" className="btn btn-secondary">
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
          <div className="space-y-4">
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Identité</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Nom {isEditMode && '*'}</label>
                    {isEditMode ? (
                      <input type="text" required value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} className="form-input" />
                    ) : (
                      <div className="py-0.5 text-gray-900">{formData.lastName || '-'}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prénom {isEditMode && '*'}</label>
                    {isEditMode ? (
                      <input type="text" required value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} className="form-input" />
                    ) : (
                      <div className="py-0.5 text-gray-900">{formData.firstName || '-'}</div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    {isEditMode ? (
                      <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="form-input" />
                    ) : (
                      <div className="py-0.5 text-gray-900">{formData.email || '-'}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Téléphone</label>
                    {isEditMode ? (
                      <PhoneInput value={formData.phone} onChange={(value) => updateField('phone', value)} />
                    ) : (
                      <div className="py-0.5 text-gray-900">{formData.phone || '-'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Affectations */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Affectations ({affectations.length})</h2>
                {affectations.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune affectation.</p>
                ) : (
                  <table className="ds-table">
                    <thead className="ds-table-header">
                      <tr>
                        <th className="ds-table-header-cell">École</th>
                        <th className="ds-table-header-cell">Classe</th>
                        <th className="ds-table-header-cell">Intervenant</th>
                        <th className="ds-table-header-cell">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="ds-table-body">
                      {affectations.map(a => (
                        <tr key={a.id} className="ds-table-row cursor-pointer hover:bg-purple-50" onClick={() => router.push(`/ecoles/${a.ecoleId}`)}>
                          <td className="ds-table-cell font-medium">{a.ecoleName || '-'}</td>
                          <td className="ds-table-cell">{a.classeName || '-'}</td>
                          <td className="ds-table-cell text-gray-500">
                            {a.intervenants && a.intervenants.length > 0
                              ? a.intervenants.map((i, idx) => (
                                  <div key={idx}>
                                    <Link href={`/collaborateurs/${i.collaborateurId}`} className="hover:text-purple-600" onClick={(e) => e.stopPropagation()}>
                                      {i.firstName} {i.lastName?.toUpperCase()}
                                    </Link>
                                  </div>
                                ))
                              : '-'}
                          </td>
                          <td className="ds-table-cell">
                            <span className={a.isActive ? 'status-badge-success' : 'status-badge-gray'}>{a.isActive ? 'Actif' : 'Inactif'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Remplacements */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Historique des remplacements ({remplacements.length})</h2>
                {remplacements.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun remplacement enregistré.</p>
                ) : (
                  <table className="ds-table">
                    <thead className="ds-table-header">
                      <tr>
                        <th className="ds-table-header-cell">Début</th>
                        <th className="ds-table-header-cell">Fin</th>
                        <th className="ds-table-header-cell">Motif</th>
                      </tr>
                    </thead>
                    <tbody className="ds-table-body">
                      {remplacements.map(r => (
                        <tr key={r.id} className="ds-table-row">
                          <td className="ds-table-cell">{r.dateDebut}</td>
                          <td className="ds-table-cell">{r.dateFin || '-'}</td>
                          <td className="ds-table-cell text-gray-500">{r.motif || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Statut</h2>
                <div className="form-group">
                  <label className="form-label">Actif</label>
                  {isEditMode ? (
                    <button type="button" onClick={() => updateField('isActive', !formData.isActive)} className={formData.isActive ? 'status-badge-success' : 'status-badge-gray'}>
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

        {isEditMode && (
          <div className="flex justify-between items-center mt-4">
            <button type="button" onClick={handleDelete} className="text-gray-400 hover:text-red-600 p-2 transition-colors" title="Supprimer">
              <TrashIcon className="w-5 h-5" />
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsEditMode(false)} className="btn btn-secondary">Annuler</button>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
