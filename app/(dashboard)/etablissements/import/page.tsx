'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpTrayIcon, ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface PeriodeScolaire {
  id: number
  code: string
  label: string
  isActive: boolean
}

interface JourPresence {
  jour: string
  creneau: string
}

interface ParsedCollaborateur {
  lastName: string
  firstName: string
  taux: string | null
  found: boolean
  remplacePour: {
    lastName: string
    firstName: string
    found: boolean
  } | null
}

interface PreviewRow {
  row: number
  etablissement: { name: string; isNew: boolean }
  ecole: { name: string; isNew: boolean; email?: string | null }
  directeur: { lastName: string; firstName: string; isNew: boolean } | null
  collaborateursSEI: ParsedCollaborateur[]
  collaborateurJoursPresence: JourPresence[]
  titulaire1: { lastName: string; firstName: string; isNew: boolean; joursPresence: JourPresence[] } | null
  titulaire2: { lastName: string; firstName: string; isNew: boolean; joursPresence: JourPresence[] } | null
  tauxEngagement: string | null
  tauxCoIntervention: string | null
  error?: string
}

interface ImportStats {
  etablissements: { created: number; updated: number }
  ecoles: { created: number; updated: number }
  directeurs: { created: number; updated: number }
  titulaires: { created: number; updated: number }
  titulaireAffectations: { created: number; updated: number }
  collaborateurEcoles: { created: number; updated: number }
  ecoleTaux: { created: number; updated: number }
  warnings: string[]
}

interface ImportResult {
  stats: ImportStats
  errors: Array<{ row: number; message: string }>
  periode: { code: string; label: string }
}

export default function ImportEtablissementsPage() {
  const [periodes, setPeriodes] = useState<PeriodeScolaire[]>([])
  const [selectedPeriode, setSelectedPeriode] = useState<string>('R25')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewValid, setPreviewValid] = useState(0)
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load périodes on mount
  useEffect(() => {
    const fetchPeriodes = async () => {
      try {
        const res = await fetch('/api/periodes-scolaires')
        if (res.ok) {
          const data = await res.json()
          setPeriodes(data.data || [])
        }
      } catch (error) {
        console.error('Error fetching périodes:', error)
      }
    }
    fetchPeriodes()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreview(null)
      setResult(null)
    }
  }

  const handlePreview = async () => {
    if (!file) return
    setPreviewing(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/etablissements/import?preview=true&periode=${selectedPeriode}`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Erreur lors du preview')
        return
      }

      setPreview(data.preview || [])
      setPreviewTotal(data.total || 0)
      setPreviewValid(data.valid || 0)
      setDetectedColumns(data.detectedColumns || [])
    } catch (error) {
      console.error('Error previewing:', error)
      alert('Erreur lors du preview')
    } finally {
      setPreviewing(false)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/etablissements/import?periode=${selectedPeriode}`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Erreur lors de l'import")
        return
      }

      setResult(data)
      setPreview(null)
    } catch (error) {
      console.error('Error importing:', error)
      alert("Erreur lors de l'import")
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatJoursPresence = (jours: JourPresence[]) => {
    if (!jours || jours.length === 0) return '-'
    return jours.map(j => {
      const jourShort = j.jour.slice(0, 2).charAt(0).toUpperCase() + j.jour.slice(1, 2)
      const creneauShort = j.creneau === 'matin' ? 'M' : j.creneau === 'apres_midi' ? 'AM' : 'J'
      return `${jourShort}(${creneauShort})`
    }).join(' ')
  }

  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <ArrowUpTrayIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Import Excel</h1>
              <p className="ds-header-subtitle">Importer établissements, écoles, directeurs et titulaires</p>
            </div>
          </div>
          <Link href="/etablissements" className="btn btn-secondary">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Retour
          </Link>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="ds-table-container mb-6">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Import terminé</h3>
                <p className="text-gray-600">Période: {result.periode.label}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-purple-700">
                  {result.stats.etablissements.created}
                </div>
                <div className="text-sm text-gray-600">Établissements créés</div>
                {result.stats.etablissements.updated > 0 && (
                  <div className="text-xs text-gray-500">+{result.stats.etablissements.updated} mis à jour</div>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-purple-700">
                  {result.stats.ecoles.created}
                </div>
                <div className="text-sm text-gray-600">Écoles créées</div>
                {result.stats.ecoles.updated > 0 && (
                  <div className="text-xs text-gray-500">+{result.stats.ecoles.updated} mises à jour</div>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-purple-700">
                  {result.stats.directeurs.created}
                </div>
                <div className="text-sm text-gray-600">Directeurs créés</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-purple-700">
                  {result.stats.titulaires.created}
                </div>
                <div className="text-sm text-gray-600">Titulaires créés</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{result.stats.titulaireAffectations.created + result.stats.titulaireAffectations.updated}</span> affectations titulaires
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">{result.stats.collaborateurEcoles.created + result.stats.collaborateurEcoles.updated}</span> affectations ISEPS
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">{result.stats.ecoleTaux.created + result.stats.ecoleTaux.updated}</span> taux enregistrés
              </div>
            </div>

            {result.stats.warnings.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-amber-600 mb-2">
                  {result.stats.warnings.length} avertissement{result.stats.warnings.length !== 1 ? 's' : ''}
                </h4>
                <div className="bg-amber-50 rounded-md p-3 max-h-40 overflow-y-auto">
                  {result.stats.warnings.map((warn, i) => (
                    <p key={i} className="text-sm text-amber-700">{warn}</p>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-red-600 mb-2">
                  {result.errors.length} erreur{result.errors.length !== 1 ? 's' : ''}
                </h4>
                <div className="bg-red-50 rounded-md p-3 max-h-40 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-sm text-red-700">
                      Ligne {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Link href="/etablissements" className="btn btn-primary">
                Voir les établissements
              </Link>
              <Link href="/parametres/import" className="btn btn-secondary">
                Nouvel import
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Upload Step */}
      {!result && (
        <div className="ds-table-container mb-6">
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">1. Sélectionner un fichier et une période</h3>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="form-label">Fichier Excel</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="form-input"
                />
              </div>
              <div className="w-48">
                <label className="form-label">Période scolaire</label>
                <select
                  value={selectedPeriode}
                  onChange={(e) => setSelectedPeriode(e.target.value)}
                  className="form-input"
                >
                  {periodes.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} - {p.label}
                    </option>
                  ))}
                  {periodes.length === 0 && (
                    <option value="R25">R25 - Rentrée 2025-2026</option>
                  )}
                </select>
              </div>
              <button
                onClick={handlePreview}
                disabled={!file || previewing}
                className="btn btn-primary"
              >
                {previewing ? 'Analyse...' : 'Analyser'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Les données sont lues à partir de la cellule C5. Colonnes attendues : Établissement, École, Nom Direction, Email direction, E-mail école, Nom co-int. SEI, jours présence ISEPS, Titulaire n°1/2, Taux, Commentaires...
            </p>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {preview && (
        <div>
          {/* Detected columns for debugging */}
          {detectedColumns.length > 0 && (
            <div className="ds-table-container mb-4">
              <div className="p-3">
                <p className="text-xs text-gray-500">
                  <strong>Colonnes détectées :</strong> {detectedColumns.join(' | ')}
                </p>
              </div>
            </div>
          )}

          <div className="ds-table-container mb-4">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">
                  <strong>{previewTotal}</strong> lignes lues
                </span>
                <span className="text-sm text-green-700">
                  <strong>{previewValid}</strong> valides
                </span>
                {previewTotal - previewValid > 0 && (
                  <span className="text-sm text-red-700">
                    <strong>{previewTotal - previewValid}</strong> en erreur
                  </span>
                )}
              </div>
              <button
                onClick={handleImport}
                disabled={importing || previewValid === 0}
                className="btn btn-primary"
              >
                {importing ? 'Import en cours...' : `Importer ${previewValid} ligne${previewValid !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          <div className="ds-table-container !overflow-x-auto">
            <table className="ds-table">
              <thead className="ds-table-header">
                <tr>
                  <th className="ds-table-header-cell">Ligne</th>
                  <th className="ds-table-header-cell">Statut</th>
                  <th className="ds-table-header-cell">Établissement</th>
                  <th className="ds-table-header-cell">École</th>
                  <th className="ds-table-header-cell">Directeur</th>
                  <th className="ds-table-header-cell">ISEPS</th>
                  <th className="ds-table-header-cell">Jours ISEPS</th>
                  <th className="ds-table-header-cell">Titulaire 1</th>
                  <th className="ds-table-header-cell">Titulaire 2</th>
                  <th className="ds-table-header-cell">Taux</th>
                </tr>
              </thead>
              <tbody className="ds-table-body">
                {preview.map((row, i) => (
                  <tr key={i} className={`ds-table-row ${row.error ? 'bg-red-50' : ''}`}>
                    <td className="ds-table-cell text-gray-500">{row.row}</td>
                    <td className="ds-table-cell">
                      {row.error ? (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                          {row.error}
                        </span>
                      ) : (
                        <span className="status-badge-success">OK</span>
                      )}
                    </td>
                    <td className="ds-table-cell">
                      <span className="font-medium">{row.etablissement.name || '-'}</span>
                      {row.etablissement.isNew && row.etablissement.name && (
                        <span className="ml-1 text-xs text-green-600">(NOUVEAU)</span>
                      )}
                    </td>
                    <td className="ds-table-cell">
                      <span className="font-medium">{row.ecole.name || '-'}</span>
                      {row.ecole.isNew && row.ecole.name && (
                        <span className="ml-1 text-xs text-green-600">(NOUVEAU)</span>
                      )}
                    </td>
                    <td className="ds-table-cell text-gray-600">
                      {row.directeur ? (
                        <>
                          {row.directeur.firstName} {row.directeur.lastName}
                          {row.directeur.isNew && (
                            <span className="ml-1 text-xs text-green-600">(NOUVEAU)</span>
                          )}
                        </>
                      ) : '-'}
                    </td>
                    <td className="ds-table-cell">
                      {row.collaborateursSEI.length > 0 ? (
                        <div className="space-y-1">
                          {row.collaborateursSEI.map((c, idx) => (
                            <div key={idx}>
                              <div className="flex items-center gap-2">
                                <span className={c.found ? 'status-badge-success text-xs' : 'status-badge-gray text-xs'}>
                                  {c.found ? 'OK' : '?'}
                                </span>
                                <span className="text-gray-600">
                                  {c.firstName} {c.lastName}
                                </span>
                                {c.taux && <span className="text-xs text-gray-500">({c.taux}%)</span>}
                              </div>
                              {c.remplacePour && (
                                <div className="text-xs text-gray-500 ml-6 flex items-center gap-1">
                                  <span>↳ remplace</span>
                                  <span className={c.remplacePour.found ? 'text-green-600' : 'text-amber-600'}>
                                    {c.remplacePour.firstName} {c.remplacePour.lastName}
                                  </span>
                                  {!c.remplacePour.found && <span className="text-amber-600">(?)</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="ds-table-cell text-gray-500 text-xs">
                      {formatJoursPresence(row.collaborateurJoursPresence)}
                    </td>
                    <td className="ds-table-cell text-gray-600">
                      {row.titulaire1 ? (
                        <>
                          {row.titulaire1.firstName} {row.titulaire1.lastName}
                          {row.titulaire1.isNew && (
                            <span className="ml-1 text-xs text-green-600">(NOUVEAU)</span>
                          )}
                          <div className="text-xs text-gray-400">
                            {formatJoursPresence(row.titulaire1.joursPresence)}
                          </div>
                        </>
                      ) : '-'}
                    </td>
                    <td className="ds-table-cell text-gray-600">
                      {row.titulaire2 ? (
                        <>
                          {row.titulaire2.firstName} {row.titulaire2.lastName}
                          {row.titulaire2.isNew && (
                            <span className="ml-1 text-xs text-green-600">(NOUVEAU)</span>
                          )}
                          <div className="text-xs text-gray-400">
                            {formatJoursPresence(row.titulaire2.joursPresence)}
                          </div>
                        </>
                      ) : '-'}
                    </td>
                    <td className="ds-table-cell text-gray-500 text-xs">
                      {row.tauxEngagement && <div>Eng: {row.tauxEngagement}%</div>}
                      {row.tauxCoIntervention && <div>Co-int: {row.tauxCoIntervention}%</div>}
                      {!row.tauxEngagement && !row.tauxCoIntervention && '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
