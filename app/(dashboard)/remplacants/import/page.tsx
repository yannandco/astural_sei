'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowUpTrayIcon, ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface PreviewRow {
  row: number
  data: Record<string, unknown>
  error?: string
}

interface ImportResult {
  imported: number
  updated: number
  remarquesCreated: number
  errors: Array<{ row: number; message: string }>
}

export default function ImportRemplacantsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewValid, setPreviewValid] = useState(0)
  const [sheetName, setSheetName] = useState<string | null>(null)
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreview(null)
      setResult(null)
      setSheetName(null)
    }
  }

  const handlePreview = async () => {
    if (!file) return
    setPreviewing(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/remplacants/import?preview=true', {
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
      setSheetName(data.sheetName || null)
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

      const res = await fetch('/api/remplacants/import', {
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
    setSheetName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
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
              <p className="ds-header-subtitle">Importer des remplaçants depuis un fichier Excel</p>
            </div>
          </div>
          <Link href="/remplacants" className="btn btn-secondary">
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
                <p className="text-gray-600">
                  {result.imported > 0 && <>{result.imported} créé{result.imported !== 1 ? 's' : ''}</>}
                  {result.imported > 0 && result.updated > 0 && ', '}
                  {result.updated > 0 && <>{result.updated} mis à jour</>}
                  {result.remarquesCreated > 0 && <>, {result.remarquesCreated} remarque{result.remarquesCreated !== 1 ? 's' : ''} créée{result.remarquesCreated !== 1 ? 's' : ''}</>}
                  {result.imported === 0 && result.updated === 0 && 'Aucun changement'}
                </p>
              </div>
            </div>

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
              <Link href="/remplacants" className="btn btn-primary">
                Voir les remplaçants
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
            <h3 className="text-base font-semibold text-gray-900 mb-4">1. Sélectionner un fichier</h3>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="form-input flex-1"
              />
              <button
                onClick={handlePreview}
                disabled={!file || previewing}
                className="btn btn-primary"
              >
                {previewing ? 'Analyse...' : 'Analyser'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Colonnes attendues : Noms, Adresse, Téléphone, Email, Disponible période actuelle, Remarques, Contrat horaire du, fin contrat horaire, Obs
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
                  {sheetName && <span className="text-gray-500 ml-1">(feuille: {sheetName})</span>}
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
                {importing ? 'Import en cours...' : `Importer ${previewValid} remplaçant${previewValid !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          <div className="ds-table-container !overflow-x-auto">
              <table className="ds-table">
                <thead className="ds-table-header">
                  <tr>
                    <th className="ds-table-header-cell">Ligne</th>
                    <th className="ds-table-header-cell">Statut</th>
                    <th className="ds-table-header-cell">Nom</th>
                    <th className="ds-table-header-cell">Prénom</th>
                    <th className="ds-table-header-cell">Adresse</th>
                    <th className="ds-table-header-cell">Téléphone</th>
                    <th className="ds-table-header-cell">Email</th>
                    <th className="ds-table-header-cell">Disponible</th>
                    <th className="ds-table-header-cell">Date début</th>
                    <th className="ds-table-header-cell">Date fin</th>
                    <th className="ds-table-header-cell">Obs</th>
                    <th className="ds-table-header-cell">Remarque</th>
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
                      <td className="ds-table-cell font-medium">{String(row.data.lastName || '-')}</td>
                      <td className="ds-table-cell">{String(row.data.firstName || '-')}</td>
                      <td className="ds-table-cell text-gray-500">{String(row.data.address || '-')}</td>
                      <td className="ds-table-cell text-gray-500">{String(row.data.phone || '-')}</td>
                      <td className="ds-table-cell text-gray-500">{String(row.data.email || '-')}</td>
                      <td className="ds-table-cell">
                        {row.data.isAvailable ? (
                          <span className="status-badge-success">Oui</span>
                        ) : (
                          <span className="status-badge-gray">Non</span>
                        )}
                      </td>
                      <td className="ds-table-cell text-gray-500">{String(row.data.contractStartDate || '-')}</td>
                      <td className="ds-table-cell text-gray-500">{String(row.data.contractEndDate || '-')}</td>
                      <td className="ds-table-cell text-gray-500 max-w-[150px] truncate" title={String(row.data.obsTemporaire || '')}>
                        {String(row.data.obsTemporaire || '-')}
                      </td>
                      <td className="ds-table-cell text-gray-500 max-w-[150px] truncate" title={String(row.data.remarqueContent || '')}>
                        {String(row.data.remarqueContent || '-')}
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
