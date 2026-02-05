'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon, AcademicCapIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface Etablissement {
  id: number
  name: string
}

interface Ecole {
  id: number
  name: string
  etablissementId: number
  etablissementName: string | null
  directeurId: number | null
  directeurLastName: string | null
  directeurFirstName: string | null
  etabDirecteurLastName: string | null
  etabDirecteurFirstName: string | null
  titulairesNoms: string | null
  collaborateursNoms: string | null
  isActive: boolean
}

export default function EcolesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Ecole[]>([])
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterEtablissement, setFilterEtablissement] = useState('')
  const [filterActif, setFilterActif] = useState('')

  type SortKey = 'name' | 'etablissementName' | 'directeurLastName' | 'isActive'
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Helper to get effective directeur (own or inherited)
  const getEffectiveDirecteur = (item: Ecole) => {
    if (item.directeurId) {
      return { lastName: item.directeurLastName, firstName: item.directeurFirstName, inherited: false }
    }
    if (item.etabDirecteurLastName && item.etabDirecteurFirstName) {
      return { lastName: item.etabDirecteurLastName, firstName: item.etabDirecteurFirstName, inherited: true }
    }
    return null
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      if (sortKey === 'isActive') {
        aVal = a.isActive ? 1 : 0
        bVal = b.isActive ? 1 : 0
      } else if (sortKey === 'directeurLastName') {
        const aDir = getEffectiveDirecteur(a)
        const bDir = getEffectiveDirecteur(b)
        aVal = (aDir?.lastName || '').toLowerCase()
        bVal = (bDir?.lastName || '').toLowerCase()
      } else if (sortKey === 'etablissementName') {
        aVal = (a.etablissementName || '').toLowerCase()
        bVal = (b.etablissementName || '').toLowerCase()
      } else {
        aVal = (a.name || '').toLowerCase()
        bVal = (b.name || '').toLowerCase()
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [items, sortKey, sortDir])

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterEtablissement) params.set('etablissementId', filterEtablissement)
      if (filterActif) params.set('isActive', filterActif)

      const res = await fetch(`/api/ecoles?${params.toString()}`)
      const data = await res.json()
      setItems(data.data || [])
    } catch (error) {
      console.error('Error fetching ecoles:', error)
    } finally {
      setLoading(false)
    }
  }, [search, filterEtablissement, filterActif])

  const fetchEtablissements = async () => {
    try {
      const res = await fetch('/api/etablissements')
      const data = await res.json()
      setEtablissements(data.data || [])
    } catch (error) {
      console.error('Error fetching etablissements:', error)
    }
  }

  useEffect(() => {
    fetchEtablissements()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchItems(), 300)
    return () => clearTimeout(timer)
  }, [fetchItems])

  return (
    <div>
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <AcademicCapIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Écoles</h1>
              <p className="ds-header-subtitle">{items.length} école{items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Link href="/ecoles/new" className="btn btn-primary">
            <PlusIcon className="w-4 h-4 mr-2" />
            Ajouter
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="ds-table-container mb-4">
        <div className="p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} className="form-input pl-9" />
          </div>
          <select value={filterEtablissement} onChange={(e) => setFilterEtablissement(e.target.value)} className="form-input w-auto">
            <option value="">Tous les établissements</option>
            {etablissements.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <select value={filterActif} onChange={(e) => setFilterActif(e.target.value)} className="form-input w-auto">
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="ds-empty-state"><div className="ds-empty-state-content"><div className="spinner-md mx-auto mb-4"></div><p className="text-gray-500">Chargement...</p></div></div>
      ) : items.length === 0 ? (
        <div className="ds-empty-state"><div className="ds-empty-state-content"><div className="ds-empty-state-icon-wrapper"><AcademicCapIcon className="ds-empty-state-icon" /></div><h3 className="ds-empty-state-title">Aucune école</h3><p className="ds-empty-state-text">Commencez par ajouter une école.</p></div></div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                {([['name', 'Nom'], ['etablissementName', 'Établissement'], ['directeurLastName', 'Directeur']] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="ds-table-header-cell cursor-pointer select-none hover:text-purple-700 transition-colors" onClick={() => toggleSort(key)}>
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey === key ? (sortDir === 'asc' ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />) : <span className="w-3.5" />}
                    </span>
                  </th>
                ))}
                <th className="ds-table-header-cell">Titulaires</th>
                <th className="ds-table-header-cell">Collaborateurs</th>
                <th className="ds-table-header-cell cursor-pointer select-none hover:text-purple-700 transition-colors" onClick={() => toggleSort('isActive')}>
                  <span className="inline-flex items-center gap-1">
                    Statut
                    {sortKey === 'isActive' ? (sortDir === 'asc' ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />) : <span className="w-3.5" />}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {sortedItems.map((item) => (
                <tr key={item.id} className="ds-table-row cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => router.push(`/ecoles/${item.id}`)}>
                  <td className="ds-table-cell font-medium text-gray-900">{item.name}</td>
                  <td className="ds-table-cell text-gray-500">{item.etablissementName || '-'}</td>
                  <td className="ds-table-cell text-gray-500">
                    {(() => {
                      const dir = getEffectiveDirecteur(item)
                      if (!dir) return '-'
                      const name = `${dir.lastName?.toUpperCase() || ''} ${dir.firstName || ''}`.trim()
                      return dir.inherited ? (
                        <span className="text-gray-400 italic">{name}</span>
                      ) : (
                        <span>{name}</span>
                      )
                    })()}
                  </td>
                  <td className="ds-table-cell text-gray-500 text-sm">
                    {item.titulairesNoms ? (
                      <div className="flex flex-col gap-0.5">
                        {item.titulairesNoms.split(',').map((nom, i) => (
                          <span key={i}>{nom.trim()}</span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="ds-table-cell text-gray-500 text-sm">
                    {item.collaborateursNoms ? (
                      <div className="flex flex-col gap-0.5">
                        {item.collaborateursNoms.split(',').map((nom, i) => (
                          <span key={i}>{nom.trim()}</span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="ds-table-cell">
                    <span className={item.isActive ? 'status-badge-success' : 'status-badge-gray'}>{item.isActive ? 'Actif' : 'Inactif'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
