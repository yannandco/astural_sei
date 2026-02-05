'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon, UserGroupIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface Remplacant {
  id: number
  lastName: string
  firstName: string
  phone: string | null
  email: string | null
  isAvailable: boolean
  contractStartDate: string | null
  contractEndDate: string | null
  isActive: boolean
}

export default function RemplacantsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Remplacant[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterActif, setFilterActif] = useState('')
  const [filterDisponible, setFilterDisponible] = useState('')

  type SortKey = 'lastName' | 'email' | 'isAvailable' | 'isActive'
  const [sortKey, setSortKey] = useState<SortKey>('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      if (sortKey === 'isActive') {
        aVal = a.isActive ? 1 : 0
        bVal = b.isActive ? 1 : 0
      } else if (sortKey === 'isAvailable') {
        aVal = a.isAvailable ? 1 : 0
        bVal = b.isAvailable ? 1 : 0
      } else if (sortKey === 'email') {
        aVal = (a.email || '').toLowerCase()
        bVal = (b.email || '').toLowerCase()
      } else {
        aVal = `${a.lastName} ${a.firstName}`.toLowerCase()
        bVal = `${b.lastName} ${b.firstName}`.toLowerCase()
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
      if (filterActif) params.set('isActive', filterActif)
      if (filterDisponible) params.set('isAvailable', filterDisponible)

      const res = await fetch(`/api/remplacants?${params.toString()}`)
      const data = await res.json()
      setItems(data.data || [])
    } catch (error) {
      console.error('Error fetching remplacants:', error)
    } finally {
      setLoading(false)
    }
  }, [search, filterActif, filterDisponible])

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
              <UserGroupIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Remplaçants</h1>
              <p className="ds-header-subtitle">{items.length} remplaçant{items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Link href="/remplacants/new" className="btn btn-primary">
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
            <input type="text" placeholder="Rechercher par nom, prénom, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="form-input pl-9" />
          </div>
          <select value={filterDisponible} onChange={(e) => setFilterDisponible(e.target.value)} className="form-input w-auto">
            <option value="">Tous (dispo)</option>
            <option value="true">Disponibles</option>
            <option value="false">Indisponibles</option>
          </select>
          <select value={filterActif} onChange={(e) => setFilterActif(e.target.value)} className="form-input w-auto">
            <option value="">Tous (statut)</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="ds-empty-state"><div className="ds-empty-state-content"><div className="spinner-md mx-auto mb-4"></div><p className="text-gray-500">Chargement...</p></div></div>
      ) : items.length === 0 ? (
        <div className="ds-empty-state"><div className="ds-empty-state-content"><div className="ds-empty-state-icon-wrapper"><UserGroupIcon className="ds-empty-state-icon" /></div><h3 className="ds-empty-state-title">Aucun remplaçant</h3><p className="ds-empty-state-text">Commencez par ajouter un remplaçant.</p></div></div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                {([['lastName', 'Nom'], ['email', 'Contact'], ['isAvailable', 'Disponible'], ['isActive', 'Statut']] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="ds-table-header-cell cursor-pointer select-none hover:text-purple-700 transition-colors" onClick={() => toggleSort(key)}>
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey === key ? (sortDir === 'asc' ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />) : <span className="w-3.5" />}
                    </span>
                  </th>
                ))}
                <th className="ds-table-header-cell">Contrat</th>
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {sortedItems.map((item) => (
                <tr key={item.id} className="ds-table-row cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => router.push(`/remplacants/${item.id}`)}>
                  <td className="ds-table-cell font-medium text-gray-900">{item.lastName?.toUpperCase()} {item.firstName}</td>
                  <td className="ds-table-cell text-gray-500">
                    <div className="text-sm">{item.email || '-'}</div>
                    <div className="text-xs text-gray-400">{item.phone || ''}</div>
                  </td>
                  <td className="ds-table-cell">
                    {item.isAvailable ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircleIcon className="w-4 h-4" /> Oui
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <XCircleIcon className="w-4 h-4" /> Non
                      </span>
                    )}
                  </td>
                  <td className="ds-table-cell">
                    <span className={item.isActive ? 'status-badge-success' : 'status-badge-gray'}>{item.isActive ? 'Actif' : 'Inactif'}</span>
                  </td>
                  <td className="ds-table-cell text-gray-500 text-sm">
                    {item.contractStartDate || item.contractEndDate
                      ? `${item.contractStartDate ? new Date(item.contractStartDate).toLocaleDateString('fr-FR') : '?'} → ${item.contractEndDate ? new Date(item.contractEndDate).toLocaleDateString('fr-FR') : '?'}`
                      : '-'}
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
