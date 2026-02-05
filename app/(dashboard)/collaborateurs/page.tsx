'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon, UsersIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface Sector {
  id: number
  name: string
}

interface Ecole {
  id: number
  name: string
}

interface Collaborateur {
  id: number
  lastName: string
  firstName: string
  address: string | null
  postalCode: string | null
  city: string | null
  mobilePro: string | null
  email: string | null
  secteurId: number | null
  taux: string | null
  contratType: 'CDI' | 'CDD' | 'Mixte' | null
  contratDetails: string | null
  canton: string | null
  pays: string | null
  sexe: 'M' | 'F' | null
  dateSortie: string | null
  isActive: boolean
  secteurName: string | null
  secteurColor: string | null
  ecoles: Ecole[]
}

export default function CollaborateursPage() {
  const router = useRouter()
  const [collabs, setCollabs] = useState<Collaborateur[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterSecteur, setFilterSecteur] = useState('')
  const [filterContrat, setFilterContrat] = useState('')
  const [filterActif, setFilterActif] = useState('')

  // Sort
  type SortKey = 'lastName' | 'firstName' | 'email' | 'mobilePro' | 'secteurName' | 'isActive'
  const [sortKey, setSortKey] = useState<SortKey>('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedCollabs = useMemo(() => {
    const sorted = [...collabs].sort((a, b) => {
      let aVal: string | number | boolean = ''
      let bVal: string | number | boolean = ''

      if (sortKey === 'isActive') {
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
    return sorted
  }, [collabs, sortKey, sortDir])

  const fetchCollabs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterSecteur) params.set('secteurId', filterSecteur)
      if (filterContrat) params.set('contratType', filterContrat)
      if (filterActif) params.set('isActive', filterActif)

      const res = await fetch(`/api/collaborateurs?${params.toString()}`)
      const data = await res.json()
      setCollabs(data.data || [])
    } catch (error) {
      console.error('Error fetching collaborateurs:', error)
    } finally {
      setLoading(false)
    }
  }, [search, filterSecteur, filterContrat, filterActif])

  const fetchSectors = async () => {
    try {
      const res = await fetch('/api/sectors')
      const data = await res.json()
      setSectors(data.data || [])
    } catch (error) {
      console.error('Error fetching sectors:', error)
    }
  }

  useEffect(() => {
    fetchSectors()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCollabs()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchCollabs])

  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <UsersIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Collaborateurs</h1>
              <p className="ds-header-subtitle">{collabs.length} collaborateur{collabs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Link href="/collaborateurs/new" className="btn btn-primary">
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
              placeholder="Rechercher par nom, prénom, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9"
            />
          </div>
          <select
            value={filterSecteur}
            onChange={(e) => setFilterSecteur(e.target.value)}
            className="form-input w-auto"
          >
            <option value="">Tous les secteurs</option>
            {sectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterContrat}
            onChange={(e) => setFilterContrat(e.target.value)}
            className="form-input w-auto"
          >
            <option value="">Tous les contrats</option>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Mixte">Mixte</option>
          </select>
          <select
            value={filterActif}
            onChange={(e) => setFilterActif(e.target.value)}
            className="form-input w-auto"
          >
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
      ) : collabs.length === 0 ? (
        <div className="ds-empty-state">
          <div className="ds-empty-state-content">
            <div className="ds-empty-state-icon-wrapper">
              <UsersIcon className="ds-empty-state-icon" />
            </div>
            <h3 className="ds-empty-state-title">Aucun collaborateur</h3>
            <p className="ds-empty-state-text">Commencez par ajouter un collaborateur ou importer un fichier Excel.</p>
          </div>
        </div>
      ) : (
        <div className="ds-table-container">
          <table className="ds-table">
            <thead className="ds-table-header">
              <tr>
                {([
                  ['lastName', 'Nom'],
                  ['email', 'Email'],
                  ['mobilePro', 'Mobile'],
                  ['secteurName', 'Secteur'],
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
                <th className="ds-table-header-cell">Affectation</th>
                <th
                  className="ds-table-header-cell cursor-pointer select-none hover:text-purple-700 transition-colors"
                  onClick={() => toggleSort('isActive')}
                >
                  <span className="inline-flex items-center gap-1">
                    Statut
                    {sortKey === 'isActive' ? (
                      sortDir === 'asc'
                        ? <ChevronUpIcon className="w-3.5 h-3.5" />
                        : <ChevronDownIcon className="w-3.5 h-3.5" />
                    ) : (
                      <span className="w-3.5" />
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="ds-table-body">
              {sortedCollabs.map((collab) => (
                <tr
                  key={collab.id}
                  className="ds-table-row cursor-pointer hover:bg-purple-50 transition-colors"
                  onClick={() => router.push(`/collaborateurs/${collab.id}`)}
                >
                  <td className="ds-table-cell font-medium text-gray-900">{collab.lastName?.toUpperCase()} {collab.firstName}</td>
                  <td className="ds-table-cell text-gray-500">{collab.email || '-'}</td>
                  <td className="ds-table-cell text-gray-500">{collab.mobilePro || '-'}</td>
                  <td className="ds-table-cell">
                    {collab.secteurName ? (
                      <span className="inline-flex items-center gap-1.5">
                        {collab.secteurColor && (
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: collab.secteurColor }} />
                        )}
                        {collab.secteurName}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="ds-table-cell text-gray-600">
                    {collab.ecoles && collab.ecoles.length > 0 ? (
                      <span>{collab.ecoles.map(e => e.name).join(', ')}</span>
                    ) : '-'}
                  </td>
                  <td className="ds-table-cell">
                    <span className={collab.isActive ? 'status-badge-success' : 'status-badge-gray'}>
                      {collab.isActive ? 'Actif' : 'Inactif'}
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
