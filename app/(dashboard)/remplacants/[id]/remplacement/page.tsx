'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeftIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { CRENEAU_LABELS, type Creneau } from '@/components/planning'

interface AffectationDetail {
  id: number
  collaborateurId: number
  collaborateurNom: string | null
  collaborateurPrenom: string | null
  collaborateurEmail: string | null
  collaborateurMobilePro: string | null
  ecoleId: number
  ecoleNom: string | null
  directeurNom: string | null
  directeurPrenom: string | null
  directeurEmail: string | null
  directeurPhone: string | null
  titulairesNoms: string | null
  titulairesEmails: string | null
  titulairesPhones: string | null
  dateDebut: string
  dateFin: string
  creneau: string
  motif: string | null
  isActive: boolean
}

interface EcoleDetail {
  id: number
  name: string
  rue: string | null
  codePostal: string | null
  ville: string | null
  phone: string | null
  email: string | null
}

interface DayEntry {
  date: string
  label: string
  creneaux: string[]
}

export default function RemplacementDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const remplacantId = params.id as string
  const idsParam = searchParams.get('ids')

  const [loading, setLoading] = useState(true)
  const [affectations, setAffectations] = useState<AffectationDetail[]>([])
  const [ecole, setEcole] = useState<EcoleDetail | null>(null)
  const [remplacantName, setRemplacantName] = useState('')

  useEffect(() => {
    if (!idsParam) {
      router.push(`/remplacants/${remplacantId}`)
      return
    }

    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n))
    if (ids.length === 0) {
      router.push(`/remplacants/${remplacantId}`)
      return
    }

    const fetchData = async () => {
      try {
        // Fetch remplaçant info + all affectations
        const [remplacantRes, affRes] = await Promise.all([
          fetch(`/api/remplacants/${remplacantId}`),
          fetch(`/api/remplacants/${remplacantId}/affectations?activeOnly=false`),
        ])

        if (remplacantRes.ok) {
          const { data } = await remplacantRes.json()
          setRemplacantName(`${data.firstName} ${data.lastName}`)
        }

        if (affRes.ok) {
          const { data } = await affRes.json()
          const filtered = (data as AffectationDetail[]).filter(a => ids.includes(a.id))
          setAffectations(filtered)

          // Fetch école details if we have affectations
          if (filtered.length > 0) {
            const ecoleId = filtered[0].ecoleId
            const ecoleRes = await fetch(`/api/ecoles/${ecoleId}`)
            if (ecoleRes.ok) {
              const ecoleData = await ecoleRes.json()
              setEcole(ecoleData.data)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching remplacement details:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [remplacantId, idsParam, router])

  // Compute grouped day entries from affectations
  const dayEntries = useMemo((): DayEntry[] => {
    if (affectations.length === 0) return []

    const dayMap = new Map<string, Set<string>>()

    for (const aff of affectations) {
      const existing = dayMap.get(aff.dateDebut)
      if (existing) {
        existing.add(aff.creneau)
      } else {
        dayMap.set(aff.dateDebut, new Set([aff.creneau]))
      }
    }

    const days = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, creneaux]) => {
        const d = new Date(date)
        const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']
        const label = `${dayNames[d.getDay()]} ${d.toLocaleDateString('fr-FR')}`

        const creneauxArr = [...creneaux]
        const hasM = creneauxArr.includes('matin')
        const hasAM = creneauxArr.includes('apres_midi')
        const hasJ = creneauxArr.includes('journee')

        let displayCreneaux: string[]
        if (hasJ || (hasM && hasAM)) {
          displayCreneaux = ['Journée']
        } else {
          displayCreneaux = creneauxArr.map(c => CRENEAU_LABELS[c as Creneau] || c)
        }

        return { date, label, creneaux: displayCreneaux }
      })

    return days
  }, [affectations])

  // Get first affectation for collaborateur/directeur/titulaires info
  const first = affectations[0] || null
  const dateDebut = affectations.length > 0
    ? affectations.reduce((min, a) => a.dateDebut < min ? a.dateDebut : min, affectations[0].dateDebut)
    : ''
  const dateFin = affectations.length > 0
    ? affectations.reduce((max, a) => a.dateFin > max ? a.dateFin : max, affectations[0].dateFin)
    : ''

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

  if (!first) {
    return (
      <div className="ds-empty-state">
        <div className="ds-empty-state-content">
          <p className="text-gray-500">Remplacement non trouvé</p>
          <button onClick={() => router.back()} className="btn btn-secondary mt-4">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Retour
          </button>
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
              <UserGroupIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">
                Remplacement de {first.collaborateurPrenom} {first.collaborateurNom}
              </h1>
              <p className="ds-header-subtitle">
                {new Date(dateDebut).toLocaleDateString('fr-FR')} - {new Date(dateFin).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/remplacants/${remplacantId}?tab=remplacements`)}
            className="btn btn-secondary"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Retour
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10">
        {/* Left column */}
        <div className="space-y-4">
          {/* Collaborateur remplacé */}
          <div className="ds-table-container">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                Collaborateur remplacé
              </h2>
              <div className="space-y-2">
                <div className="text-gray-900 font-medium">
                  {first.collaborateurPrenom} {first.collaborateurNom}
                </div>
                {first.collaborateurEmail && (
                  <div className="text-sm text-gray-600">
                    <a href={`mailto:${first.collaborateurEmail}`} className="hover:underline">{first.collaborateurEmail}</a>
                  </div>
                )}
                {first.collaborateurMobilePro && (
                  <div className="text-sm text-gray-600">
                    <a href={`tel:${first.collaborateurMobilePro}`} className="hover:underline">{first.collaborateurMobilePro}</a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Planning */}
          <div className="ds-table-container">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                Planning ({dayEntries.length} jour{dayEntries.length > 1 ? 's' : ''}, {affectations.length} créneau{affectations.length > 1 ? 'x' : ''})
              </h2>
              {dayEntries.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun créneau</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="ds-table">
                    <thead>
                      <tr className="ds-table-header">
                        <th className="ds-table-header-cell">Date</th>
                        <th className="ds-table-header-cell">Créneau</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayEntries.map((entry) => (
                        <tr key={entry.date} className="ds-table-row">
                          <td className="ds-table-cell whitespace-nowrap font-medium">
                            {entry.label}
                          </td>
                          <td className="ds-table-cell">
                            <div className="flex gap-1.5 flex-wrap">
                              {entry.creneaux.map((c) => (
                                <span key={c} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column — École */}
        <div className="space-y-4">
          <div className="ds-table-container">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                École
              </h2>
              <div className="space-y-3">
                <div className="text-gray-900 font-medium">{ecole?.name || first.ecoleNom || '-'}</div>
                {ecole && (ecole.rue || ecole.codePostal || ecole.ville) && (
                  <div className="text-sm text-gray-600">
                    {ecole.rue && <div>{ecole.rue}</div>}
                    {(ecole.codePostal || ecole.ville) && (
                      <div>{[ecole.codePostal, ecole.ville].filter(Boolean).join(' ')}</div>
                    )}
                  </div>
                )}
                {ecole?.phone && (
                  <div className="text-sm text-gray-600">
                    <a href={`tel:${ecole.phone}`} className="hover:underline">{ecole.phone}</a>
                  </div>
                )}
                {ecole?.email && (
                  <div className="text-sm text-gray-600">
                    <a href={`mailto:${ecole.email}`} className="hover:underline">{ecole.email}</a>
                  </div>
                )}
              </div>

              {/* Directeur */}
              {(first.directeurPrenom || first.directeurNom) && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Directeur</h3>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-900 font-medium">{first.directeurPrenom} {first.directeurNom}</div>
                    {first.directeurEmail && (
                      <div className="text-sm text-gray-600">
                        <a href={`mailto:${first.directeurEmail}`} className="hover:underline">{first.directeurEmail}</a>
                      </div>
                    )}
                    {first.directeurPhone && (
                      <div className="text-sm text-gray-600">
                        <a href={`tel:${first.directeurPhone}`} className="hover:underline">{first.directeurPhone}</a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Titulaires */}
              {first.titulairesNoms && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Titulaire(s)</h3>
                  <div className="space-y-2">
                    {first.titulairesNoms.split(', ').map((nom, i) => {
                      const emails = first.titulairesEmails?.split(', ') || []
                      const phones = first.titulairesPhones?.split(', ') || []
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="text-sm text-gray-900 font-medium">{nom}</div>
                          {emails[i] && (
                            <div className="text-sm text-gray-600">
                              <a href={`mailto:${emails[i]}`} className="hover:underline">{emails[i]}</a>
                            </div>
                          )}
                          {phones[i] && (
                            <div className="text-sm text-gray-600">
                              <a href={`tel:${phones[i]}`} className="hover:underline">{phones[i]}</a>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
