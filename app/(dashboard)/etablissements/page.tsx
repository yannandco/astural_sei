'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon, BuildingOffice2Icon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface Etablissement {
  id: number
  name: string
  address: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
  isActive: boolean
  ecolesCount: number
}

export default function EtablissementsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Etablissement[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterActif, setFilterActif] = useState('')

  type SortKey = 'name' | 'city' | 'ecolesCount' | 'isActive'
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      if (sortKey === 'ecolesCount') {
        aVal = a.ecolesCount
        bVal = b.ecolesCount
      } else if (sortKey === 'isActive') {
        aVal = a.isActive ? 1 : 0
        bVal = b.isActive ? 1 : 0
      } else {
        aVal = (a[sortKey] || '').toString().toLowerCase()
        bVal = (b[sortKey] || '').toString().toLowerCase()
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

      const res = await fetch(`/api/etablissements?${params.toString()}`)
      const data = await res.json()
      setItems(data.data || [])
    } catch (error) {
      console.error('Error fetching etablissements:', error)
    } finally {
      setLoading(false)
    }
  }, [search, filterActif])

  useEffect(() => {
    const timer = setTimeout(() => fetchItems(), 300)
    return () => clearTimeout(timer)
  }, [fetchItems])

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
              <h1 className="ds-header-title">Établissements</h1>
              <p className="ds-header-subtitle">{items.length} établissement{items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Link href="/etablissements/new" className="btn btn-primary">
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
            <input
              type="text"
              placeholder="Rechercher par nom, ville..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9"
            />
          </div>
          <select value={filterActif} onChange={(e) => setFilterActif(e.target.value)} className="form-input w-auto">
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
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
      ) : items.length === 0 ? (
        <div className="ds-empty-state">
          <div className="ds-empty-state-content">
            <div className="ds-empty-state-icon-wrapper">
              <BuildingOffice2Icon className="ds-empty-state-icon" />
            </div>
            <h3 className="ds-empty-state-title">Aucun établissement</h3>
            <p className="ds-empty-state-text">Commencez par ajouter un établissement.</p>
          </div>
        </div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                {([
                  ['name', 'Nom'],
                  ['city', 'Ville'],
                  ['ecolesCount', 'Écoles'],
                  ['isActive', 'Statut'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="ds-table-header-cell cursor-pointer select-none hover:text-purple-700 transition-colors"
                    onClick={() => toggleSort(key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey === key ? (
                        sortDir === 'asc'
                          ? <ChevronUpIcon className="w-3.5 h-3.5" />
                          : <ChevronDownIcon className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {sortedItems.map((item) => (
                <tr
                  key={item.id}
                  className="ds-table-row cursor-pointer hover:bg-purple-50 transition-colors"
                  onClick={() => router.push(`/etablissements/${item.id}`)}
                >
                  <td className="ds-table-cell font-medium text-gray-900">{item.name}</td>
                  <td className="ds-table-cell text-gray-500">{item.city || '-'}</td>
                  <td className="ds-table-cell">{item.ecolesCount}</td>
                  <td className="ds-table-cell">
                    <span className={item.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                      {item.isActive ? 'Actif' : 'Inactif'}
                    </span>
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
