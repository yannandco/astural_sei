'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, AcademicCapIcon, TrashIcon, PlusIcon, XMarkIcon, PencilIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import { EcoleMonthCalendar } from '@/components/planning'
import { PhoneInput } from '@/components/ui'

interface Classe { id: number; name: string; isActive: boolean }
interface Directeur { id: number; lastName: string; firstName: string }
interface TitulaireAffecte {
  id: number
  titulaireId: number
  lastName: string
  firstName: string
  joursPresence: string | null
  isActive: boolean
}
interface CollaborateurAffecte {
  id: number
  collaborateurId: number
  lastName: string
  firstName: string
  joursPresence: string | null
  tauxCoIntervention: string | null
  isActive: boolean
}

type TabType = 'informations' | 'planning'

export default function EcoleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('informations')
  const [directeurs, setDirecteurs] = useState<Directeur[]>([])
  const [classesList, setClassesList] = useState<Classe[]>([])
  const [titulairesList, setTitulairesList] = useState<TitulaireAffecte[]>([])
  const [collaborateursList, setCollaborateursList] = useState<CollaborateurAffecte[]>([])
  const [showAddClasse, setShowAddClasse] = useState(false)
  const [newClasseName, setNewClasseName] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    etablissementId: 0,
    etablissementName: '',
    directeurId: '',
    directeurLastName: '',
    directeurFirstName: '',
    rue: '',
    codePostal: '',
    ville: '',
    phone: '',
    email: '',
    remplacementApresJours: '',
    isActive: true,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ecoleRes, directeursRes] = await Promise.all([
          fetch(`/api/ecoles/${id}`),
          fetch('/api/directeurs'),
        ])

        if (!ecoleRes.ok) {
          router.push('/etablissements')
          return
        }

        const ecoleData = await ecoleRes.json()
        const directeursData = await directeursRes.json()
        const e = ecoleData.data

        setDirecteurs(directeursData.data || [])
        setFormData({
          name: e.name,
          etablissementId: e.etablissementId,
          etablissementName: e.etablissementName || '',
          directeurId: e.directeurId?.toString() || '',
          directeurLastName: e.directeurLastName || '',
          directeurFirstName: e.directeurFirstName || '',
          rue: e.rue || '',
          codePostal: e.codePostal || '',
          ville: e.ville || '',
          phone: e.phone || '',
          email: e.email || '',
          remplacementApresJours: e.remplacementApresJours?.toString() || '',
          isActive: e.isActive,
        })

        // Titulaires et collaborateurs depuis l'API école
        setTitulairesList(e.titulaires || [])
        setCollaborateursList(e.collaborateurs || [])

        const classesRes = await fetch(`/api/classes?ecoleId=${id}`)
        const classesData = await classesRes.json()
        setClassesList(classesData.data || [])
      } catch (error) {
        console.error('Error:', error)
        router.push('/etablissements')
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
      const res = await fetch(`/api/ecoles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          directeurId: formData.directeurId ? parseInt(formData.directeurId) : null,
          rue: formData.rue,
          codePostal: formData.codePostal,
          ville: formData.ville,
          phone: formData.phone,
          email: formData.email,
          remplacementApresJours: formData.remplacementApresJours || null,
          isActive: formData.isActive,
        }),
      })
      if (res.ok) setIsEditMode(false)
    } catch (error) {
      console.error('Error saving ecole:', error)
    } finally {
      setSaving(false)
    }
  }

  const getDirecteurName = () => {
    if (!formData.directeurId) return '-'
    const directeur = directeurs.find(d => d.id.toString() === formData.directeurId)
    return directeur ? `${directeur.firstName} ${directeur.lastName}` : '-'
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer cette école et toutes ses classes ?')) return
    try {
      const res = await fetch(`/api/ecoles/${id}`, { method: 'DELETE' })
      if (res.ok) router.push(`/etablissements/${formData.etablissementId}`)
    } catch (error) {
      console.error('Error deleting ecole:', error)
    }
  }

  const handleAddClasse = async () => {
    if (!newClasseName.trim()) return
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClasseName.trim(), ecoleId: parseInt(id) }),
      })
      if (res.ok) {
        setNewClasseName('')
        setShowAddClasse(false)
        const classesRes = await fetch(`/api/classes?ecoleId=${id}`)
        const classesData = await classesRes.json()
        setClassesList(classesData.data || [])
      }
    } catch (error) {
      console.error('Error adding classe:', error)
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
              <AcademicCapIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">{formData.name}</h1>
              <p className="ds-header-subtitle">
                <Link href={`/etablissements/${formData.etablissementId}`} className="text-purple-600 hover:underline">
                  {formData.etablissementName}
                </Link>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/etablissements/${formData.etablissementId}`} className="btn btn-secondary">
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('informations')}
            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'informations'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Informations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('planning')}
            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'planning'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Planning
          </button>
        </nav>
      </div>

      {activeTab === 'informations' && (
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10">
          {/* Left */}
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
                      <div className="py-0.5 text-gray-900">{formData.name || '-'}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rue</label>
                    {isEditMode ? (
                      <input type="text" value={formData.rue} onChange={(e) => updateField('rue', e.target.value)} className="form-input" />
                    ) : (
                      <div className="py-0.5 text-gray-900">{formData.rue || '-'}</div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Code postal</label>
                      {isEditMode ? (
                        <input type="text" value={formData.codePostal} onChange={(e) => updateField('codePostal', e.target.value)} className="form-input" maxLength={10} />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.codePostal || '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ville</label>
                      {isEditMode ? (
                        <input type="text" value={formData.ville} onChange={(e) => updateField('ville', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.ville || '-'}</div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Téléphone</label>
                      {isEditMode ? (
                        <PhoneInput value={formData.phone} onChange={(value) => updateField('phone', value)} />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.phone || '-'}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      {isEditMode ? (
                        <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="form-input" />
                      ) : (
                        <div className="py-0.5 text-gray-900">{formData.email || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Directeur */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Directeur</h2>
                <div className="form-group">
                  <label className="form-label">Directeur actuel</label>
                  {isEditMode ? (
                    <select value={formData.directeurId} onChange={(e) => updateField('directeurId', e.target.value)} className="form-input">
                      <option value="">-- Aucun --</option>
                      {directeurs.map(d => (
                        <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="py-0.5 text-gray-900">{getDirecteurName()}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Classes */}
            <div className="ds-table-container">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider">Classes ({classesList.length})</h2>
                  <button type="button" onClick={() => setShowAddClasse(true)} className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1">
                    <PlusIcon className="w-4 h-4" /> Ajouter
                  </button>
                </div>
                {showAddClasse && (
                  <div className="flex gap-2 mb-3">
                    <input type="text" placeholder="Nom de la classe" value={newClasseName} onChange={(e) => setNewClasseName(e.target.value)} className="form-input flex-1" />
                    <button type="button" onClick={handleAddClasse} className="btn btn-primary btn-sm">OK</button>
                    <button type="button" onClick={() => { setShowAddClasse(false); setNewClasseName('') }} className="btn btn-secondary btn-sm">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {classesList.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune classe.</p>
                ) : (
                  <div className="space-y-1">
                    {classesList.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
                        <span className="text-sm text-gray-900">{c.name}</span>
                        <span className={c.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                          {c.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Titulaires */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                  Titulaires ({titulairesList.length})
                </h2>
                {titulairesList.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun titulaire affecté.</p>
                ) : (
                  <div className="space-y-1">
                    {titulairesList.map(t => (
                      <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
                        <Link href={`/titulaires/${t.titulaireId}`} className="text-sm text-gray-900 hover:text-purple-600">
                          {t.lastName?.toUpperCase()} {t.firstName}
                        </Link>
                        <span className={t.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                          {t.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Collaborateurs */}
            <div className="ds-table-container">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                  Collaborateurs ({collaborateursList.length})
                </h2>
                {collaborateursList.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun collaborateur affecté.</p>
                ) : (
                  <div className="space-y-1">
                    {collaborateursList.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
                        <Link href={`/collaborateurs/${c.collaborateurId}`} className="text-sm text-gray-900 hover:text-purple-600">
                          {c.lastName?.toUpperCase()} {c.firstName}
                          {c.tauxCoIntervention && <span className="text-gray-400 ml-2">({c.tauxCoIntervention}%)</span>}
                        </Link>
                        <span className={c.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                          {c.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right */}
          <div className="space-y-4">
            {/* Délai de remplacement - prominent card */}
            <div className="ds-table-container border-purple-200">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-purple-100">Délai de remplacement</h2>
                {isEditMode ? (
                  <div className="form-group">
                    <label className="form-label">Nombre de jours</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.remplacementApresJours}
                      onChange={(e) => updateField('remplacementApresJours', e.target.value)}
                      className="form-input"
                      placeholder="Ex: 1.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nombre de jours après le début d&apos;une absence pour trouver un remplaçant
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {formData.remplacementApresJours !== '' ? (
                      <>
                        <span className="text-3xl font-bold text-purple-700">{formData.remplacementApresJours}</span>
                        <span className="text-sm text-gray-600">jour{parseFloat(formData.remplacementApresJours) > 1 ? 's' : ''} pour remplacer</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Non défini</span>
                    )}
                  </div>
                )}
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
      )}

      {activeTab === 'planning' && (
        <div className="ds-table-container">
          <div className="p-5">
            <EcoleMonthCalendar ecoleId={parseInt(id)} />
          </div>
        </div>
      )}
    </div>
  )
}
