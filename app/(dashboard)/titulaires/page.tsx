'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon, UserIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface TitulaireAffectation {
  ecoleName: string | null
  etablissementName: string | null
  classeName: string | null
}

interface Titulaire {
  id: number
  lastName: string
  firstName: string
  email: string | null
  phone: string | null
  isActive: boolean
  affectations: TitulaireAffectation[]
}

export default function TitulairesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Titulaire[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  type SortKey = 'lastName' | 'firstName' | 'email' | 'isActive'
  const [sortKey, setSortKey] = useState<SortKey>('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal: string | number = sortKey === 'isActive' ? (a.isActive ? 1 : 0) : (a[sortKey] || '').toString().toLowerCase()
      let bVal: string | number = sortKey === 'isActive' ? (b.isActive ? 1 : 0) : (b[sortKey] || '').toString().toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [items, sortKey, sortDir])

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/titulaires?${params.toString()}`)
      const data = await res.json()
      setItems(data.data || [])
    } catch (error) {
      console.error('Error fetching titulaires:', error)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => fetchItems(), 300)
    return () => clearTimeout(timer)
  }, [fetchItems])

  return (
    <div>
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper"><UserIcon className="ds-header-icon" /></div>
            <div>
              <h1 className="ds-header-title">Titulaires</h1>
              <p className="ds-header-subtitle">{items.length} titulaire{items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Link href="/titulaires/new" className="btn btn-primary">
            <PlusIcon className="w-4 h-4 mr-2" />
            Ajouter
          </Link>
        </div>
      </div>

      <div className="ds-table-container mb-4">
        <div className="p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher par nom, prénom, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="form-input pl-9" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="ds-empty-state"><div className="ds-empty-state-content"><div className="spinner-md mx-auto mb-4"></div><p className="text-gray-500">Chargement...</p></div></div>
      ) : items.length === 0 ? (
        <div className="ds-empty-state"><div className="ds-empty-state-content"><div className="ds-empty-state-icon-wrapper"><UserIcon className="ds-empty-state-icon" /></div><h3 className="ds-empty-state-title">Aucun titulaire</h3><p className="ds-empty-state-text">Commencez par ajouter un titulaire.</p></div></div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                {([['lastName', 'Nom'], ['email', 'Email']] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="ds-table-header-cell cursor-pointer select-none hover:text-purple-700 transition-colors" onClick={() => toggleSort(key)}>
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey === key ? (sortDir === 'asc' ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />) : <span className="w-3.5" />}
                    </span>
                  </th>
                ))}
                <th className="ds-table-header-cell">Établissement</th>
                <th className="ds-table-header-cell">École</th>
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
                <tr key={item.id} className="ds-table-row cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => router.push(`/titulaires/${item.id}`)}>
                  <td className="ds-table-cell font-medium text-gray-900">{item.lastName?.toUpperCase()} {item.firstName}</td>
                  <td className="ds-table-cell text-gray-500">{item.email || '-'}</td>
                  <td className="ds-table-cell text-gray-500">
                    {item.affectations.length > 0
                      ? [...new Set(item.affectations.map(a => a.etablissementName).filter(Boolean))].join(', ') || '-'
                      : '-'}
                  </td>
                  <td className="ds-table-cell text-gray-500">
                    {item.affectations.length > 0
                      ? [...new Set(item.affectations.map(a => a.ecoleName).filter(Boolean))].map((name, i) => <div key={i}>{name}</div>)
                      : '-'}
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
