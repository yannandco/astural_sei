'use client'

import { useState, useRef, Fragment } from 'react'
import Link from 'next/link'
import {
  ArrowUpTrayIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

interface PreviewRow {
  row: number
  name: string
  remarques: string | null
  disponibilitesCount: number
  libres: number
  pasDispo: number
  affectations: number
  matched: boolean
  matchedId?: number
  matchedType?: 'remplacant' | 'collaborateur'
  error?: string
  details?: Array<{
    date: string
    creneau: string
    isAvailable: boolean
    note: string | null
    affectationParsed?: {
      ecoleName: string
      personName: string | null
      ecoleFound: boolean
      ecoleId: number | null
      personFound: boolean
      personId: number | null
    } | null
  }>
}

interface DetectedDate {
  col: number
  date: string
  dayHeader: string
}

interface PreviewResult {
  preview: PreviewRow[]
  total: number
  matched: number
  matchedCollaborateurs: number
  unmatched: number
  totalDisponibilites: number
  sheetName: string
  dateRange: { start: string; end: string }
  datesCount: number
  detectedDates?: DetectedDate[]
}

interface ImportResult {
  imported: number
  updated: number
  affectationsCreated: number
  remarquesUpdated: number
  skippedNotFound: number
  skippedCollaborateurs: number
  errors: Array<{ name: string; message: string }>
}

export default function ImportDisponibilitesPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreviewData(null)
      setResult(null)
    }
  }

  const handlePreview = async () => {
    if (!file) return
    setPreviewing(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/remplacants/import-disponibilites?preview=true', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Erreur lors du preview')
        return
      }

      setPreviewData(data)
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

      const res = await fetch('/api/remplacants/import-disponibilites', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Erreur lors de l'import")
        return
      }

      setResult(data)
      setPreviewData(null)
    } catch (error) {
      console.error('Error importing:', error)
      alert("Erreur lors de l'import")
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreviewData(null)
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <CalendarDaysIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Import des disponibilités</h1>
              <p className="ds-header-subtitle">Importer les disponibilités des remplaçants depuis Excel</p>
            </div>
          </div>
          <Link href="/parametres/import" className="btn btn-secondary">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Retour
          </Link>
        </div>
      </div>

      <div className="ds-table-container">
        <div className="p-6">
          {/* Instructions */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <h3 className="text-sm font-semibold text-purple-800 mb-2">Format attendu</h3>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>- Fichier Excel avec les disponibilités par semaine</li>
              <li>- Ligne 1 : Titre</li>
              <li>- Ligne 2 : Noms des semaines (ex: &quot;semaine 18 au 22 août 2025&quot;)</li>
              <li>- Ligne 3 : Jours individuels (ex: &quot;lu 18&quot;, &quot;ma 19&quot;...)</li>
              <li>- Lignes suivantes : 2 lignes par remplaçant (matin + après-midi)</li>
              <li>- Valeurs : &quot;libre&quot;, &quot;pas dispo&quot;, ou nom d&apos;école/affectation</li>
            </ul>
          </div>

          {/* File Upload */}
          {!result && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fichier Excel (.xlsx)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
          )}

          {/* Preview Button */}
          {file && !previewData && !result && (
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="btn btn-primary"
            >
              {previewing ? 'Analyse en cours...' : 'Analyser le fichier'}
            </button>
          )}

          {/* Preview Results */}
          {previewData && !result && (
            <div>
              {/* Summary */}
              <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{previewData.total}</div>
                  <div className="text-sm text-gray-500">Personnes</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{previewData.matched}</div>
                  <div className="text-sm text-green-600">Remplaçants</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{previewData.matchedCollaborateurs}</div>
                  <div className="text-sm text-blue-600">Collaborateurs</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">{previewData.unmatched}</div>
                  <div className="text-sm text-red-600">Non trouvés</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">{previewData.totalDisponibilites}</div>
                  <div className="text-sm text-purple-600">Disponibilités</div>
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-6 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                Période : <strong>{previewData.dateRange.start}</strong> au <strong>{previewData.dateRange.end}</strong>
                {' '}({previewData.datesCount} jours)
              </div>

              {/* Preview Table */}
              <div className="mb-6 overflow-x-auto">
                <table className="ds-table">
                  <thead className="ds-table-header">
                    <tr>
                      <th className="ds-table-header-cell">Nom</th>
                      <th className="ds-table-header-cell">Remarques</th>
                      <th className="ds-table-header-cell text-center">Libres</th>
                      <th className="ds-table-header-cell text-center">Pas dispo</th>
                      <th className="ds-table-header-cell text-center">Affectations</th>
                      <th className="ds-table-header-cell text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="ds-table-body">
                    {previewData.preview.map((row, idx) => (
                      <Fragment key={idx}>
                        <tr
                          className={`ds-table-row cursor-pointer ${!row.matched ? 'bg-red-50' : row.matchedType === 'collaborateur' ? 'bg-blue-50' : ''}`}
                          onClick={() => {
                            const newSet = new Set(expandedRows)
                            if (newSet.has(idx)) {
                              newSet.delete(idx)
                            } else {
                              newSet.add(idx)
                            }
                            setExpandedRows(newSet)
                          }}
                        >
                          <td className="ds-table-cell font-medium">
                            <span className="mr-2">{expandedRows.has(idx) ? '▼' : '▶'}</span>
                            {row.name}
                          </td>
                          <td className="ds-table-cell text-gray-500 text-xs max-w-xs truncate">
                            {row.remarques || '-'}
                          </td>
                          <td className="ds-table-cell text-center">
                            <span className="text-green-600 font-medium">{row.libres}</span>
                          </td>
                          <td className="ds-table-cell text-center">
                            <span className="text-red-600 font-medium">{row.pasDispo}</span>
                          </td>
                          <td className="ds-table-cell text-center">
                            <span className="text-purple-600 font-medium">{row.affectations}</span>
                          </td>
                          <td className="ds-table-cell text-center">
                            {row.matchedType === 'remplacant' ? (
                              <span className="status-badge-success">Remplaçant</span>
                            ) : row.matchedType === 'collaborateur' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Collaborateur</span>
                            ) : (
                              <span className="status-badge-gray" title={row.error}>Non trouvé</span>
                            )}
                          </td>
                        </tr>
                        {expandedRows.has(idx) && row.details && (
                          <tr key={`${idx}-details`} className="bg-gray-50">
                            <td colSpan={6} className="ds-table-cell">
                              <div className="text-xs p-2">
                                <strong>Détails des disponibilités:</strong>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {row.details.filter(d => d.note && !(d.affectationParsed?.ecoleFound && d.affectationParsed?.personFound)).map((d, dIdx) => (
                                    <div
                                      key={dIdx}
                                      className={`p-2 rounded ${
                                        d.isAvailable
                                          ? 'bg-green-100 text-green-800'
                                          : d.affectationParsed?.ecoleFound && d.affectationParsed?.personFound
                                          ? 'bg-cyan-100 text-cyan-800'
                                          : d.note
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      <div className="font-medium">{d.date} - {d.creneau === 'matin' ? 'Matin' : 'Après-midi'}</div>
                                      <div className="truncate">
                                        {d.isAvailable ? 'Libre' : d.note || 'Pas dispo'}
                                      </div>
                                      {d.affectationParsed && (
                                        <div className="mt-1 pt-1 border-t border-current/20 text-[10px]">
                                          <div>
                                            École: <strong>{d.affectationParsed.ecoleName}</strong>
                                            {d.affectationParsed.ecoleFound
                                              ? <span className="text-green-600 ml-1">✓ (ID:{d.affectationParsed.ecoleId})</span>
                                              : <span className="text-red-600 ml-1">✗ non trouvée</span>
                                            }
                                          </div>
                                          <div>
                                            Remplacé: {d.affectationParsed.personName
                                              ? <><strong>{d.affectationParsed.personName}</strong>
                                                {d.affectationParsed.personFound
                                                  ? <span className="text-green-600 ml-1">✓ (ID:{d.affectationParsed.personId})</span>
                                                  : <span className="text-red-600 ml-1">✗ non trouvé</span>
                                                }</>
                                              : <span className="text-gray-500 italic">non spécifié</span>
                                            }
                                          </div>
                                          {d.affectationParsed.ecoleFound && d.affectationParsed.personFound && (
                                            <div className="mt-1 font-medium text-cyan-700">→ Affectation sera créée</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info for collaborateurs */}
              {previewData.matchedCollaborateurs > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      {previewData.matchedCollaborateurs} collaborateur(s) identifié(s)
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Les collaborateurs ne sont pas des remplaçants, leurs disponibilités ne seront pas importées.
                    </p>
                  </div>
                </div>
              )}

              {/* Warning for unmatched */}
              {previewData.unmatched > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      {previewData.unmatched} personne(s) non trouvée(s) en base
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Ces lignes seront ignorées lors de l&apos;import. Vérifiez que les noms correspondent à ceux enregistrés.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={importing || previewData.matched === 0}
                  className="btn btn-primary"
                >
                  {importing ? 'Import en cours...' : `Importer ${previewData.matched} remplaçants`}
                </button>
                <button onClick={reset} className="btn btn-secondary">
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Import Result */}
          {result && (
            <div>
              <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircleIcon className="w-8 h-8 text-green-600" />
                  <h3 className="text-lg font-semibold text-green-800">Import terminé</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-700">{result.imported}</div>
                    <div className="text-sm text-green-600">Disponibilités</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-indigo-700">{result.affectationsCreated}</div>
                    <div className="text-sm text-indigo-600">Affectations</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-700">{result.remarquesUpdated}</div>
                    <div className="text-sm text-purple-600">Remarques</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-700">{result.updated}</div>
                    <div className="text-sm text-orange-600">Mises à jour</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-700">{result.skippedCollaborateurs}</div>
                    <div className="text-sm text-blue-600">Collaborateurs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-700">{result.skippedNotFound}</div>
                    <div className="text-sm text-gray-600">Non trouvés</div>
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">
                    Erreurs ({result.errors.length})
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>- {err.name}: {err.message}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>... et {result.errors.length - 10} autres</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <Link href="/parametres/import" className="btn btn-primary">
                  Retour aux imports
                </Link>
                <button onClick={reset} className="btn btn-secondary">
                  Nouvel import
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
