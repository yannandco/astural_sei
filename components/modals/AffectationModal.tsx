'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  JOURS_SEMAINE,
  CRENEAUX,
  JOUR_LABELS,
  CRENEAU_LABELS,
  type JourSemaine,
  type Creneau,
} from '@/components/planning'

interface JourPresence {
  jour: JourSemaine
  creneau: Creneau
}

interface Affectation {
  id: number
  ecoleId: number
  ecoleName: string | null
  etablissementName: string | null
  periodeId: number | null
  periodeCode: string | null
  periodeLabel: string | null
  joursPresence: string | null
  isActive: boolean
}

interface Ecole {
  id: number
  name: string
  etablissementName: string | null
}

interface PeriodeScolaire {
  id: number
  code: string
  label: string
}

interface AffectationModalProps {
  isOpen: boolean
  onClose: () => void
  collaborateurId: string
  editingAffectation: Affectation | null
  ecoles: Ecole[]
  periodes: PeriodeScolaire[]
  onSuccess: () => void
}

export default function AffectationModal({
  isOpen,
  onClose,
  collaborateurId,
  editingAffectation,
  ecoles,
  periodes,
  onSuccess,
}: AffectationModalProps) {
  const [saving, setSaving] = useState(false)
  const [affectationForm, setAffectationForm] = useState({
    ecoleId: '',
    periodeId: '',
    joursPresence: [] as JourPresence[],
  })

  useEffect(() => {
    if (!isOpen) return
    if (editingAffectation) {
      let jours: JourPresence[] = []
      if (editingAffectation.joursPresence) {
        try {
          jours = JSON.parse(editingAffectation.joursPresence)
        } catch {
          jours = []
        }
      }
      const expandedJours: JourPresence[] = []
      for (const jp of jours) {
        if (jp.creneau === 'journee') {
          expandedJours.push({ jour: jp.jour, creneau: 'matin' })
          expandedJours.push({ jour: jp.jour, creneau: 'apres_midi' })
        } else {
          expandedJours.push(jp)
        }
      }
      setAffectationForm({
        ecoleId: editingAffectation.ecoleId.toString(),
        periodeId: editingAffectation.periodeId?.toString() || '',
        joursPresence: expandedJours,
      })
    } else {
      setAffectationForm({
        ecoleId: '',
        periodeId: periodes.find(p => p.code === 'R25')?.id.toString() || '',
        joursPresence: [],
      })
    }
  }, [isOpen, editingAffectation, periodes])

  const toggleJourPresence = (jour: JourSemaine, creneau: Creneau) => {
    setAffectationForm(prev => {
      const exists = prev.joursPresence.some(jp => jp.jour === jour && jp.creneau === creneau)
      if (exists) {
        return {
          ...prev,
          joursPresence: prev.joursPresence.filter(jp => !(jp.jour === jour && jp.creneau === creneau)),
        }
      } else {
        return {
          ...prev,
          joursPresence: [...prev.joursPresence, { jour, creneau }],
        }
      }
    })
  }

  const isJourSelected = (jour: JourSemaine, creneau: Creneau) => {
    return affectationForm.joursPresence.some(jp => jp.jour === jour && jp.creneau === creneau)
  }

  const handleSave = async () => {
    if (!affectationForm.ecoleId) {
      alert('Veuillez sélectionner une école')
      return
    }

    setSaving(true)
    try {
      const consolidatedJours: JourPresence[] = []
      const joursByDay = new Map<string, Set<string>>()
      for (const jp of affectationForm.joursPresence) {
        if (!joursByDay.has(jp.jour)) joursByDay.set(jp.jour, new Set())
        joursByDay.get(jp.jour)!.add(jp.creneau)
      }
      for (const [jour, creneaux] of joursByDay) {
        if (creneaux.has('matin') && creneaux.has('apres_midi')) {
          consolidatedJours.push({ jour: jour as JourSemaine, creneau: 'journee' })
        } else {
          for (const c of creneaux) {
            consolidatedJours.push({ jour: jour as JourSemaine, creneau: c as Creneau })
          }
        }
      }

      const payload = {
        ecoleId: parseInt(affectationForm.ecoleId),
        periodeId: affectationForm.periodeId ? parseInt(affectationForm.periodeId) : null,
        joursPresence: consolidatedJours,
      }

      if (editingAffectation) {
        const res = await fetch(`/api/collaborateurs/${collaborateurId}/ecoles/${editingAffectation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const error = await res.json()
          alert(error.error || 'Erreur lors de la mise à jour')
          return
        }
      } else {
        const res = await fetch(`/api/collaborateurs/${collaborateurId}/ecoles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const error = await res.json()
          alert(error.error || 'Erreur lors de la création')
          return
        }
      }

      onClose()
      onSuccess()
    } catch (error) {
      console.error('Error saving affectation:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg">
        <div className="modal-header">
          <h3 className="text-lg font-semibold">
            {editingAffectation ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">École *</label>
              <select
                value={affectationForm.ecoleId}
                onChange={(e) => setAffectationForm(prev => ({ ...prev, ecoleId: e.target.value }))}
                className="form-input"
                disabled={!!editingAffectation}
              >
                <option value="">-- Sélectionner --</option>
                {ecoles.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.etablissementName && `(${e.etablissementName})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Période scolaire</label>
              <select
                value={affectationForm.periodeId}
                onChange={(e) => setAffectationForm(prev => ({ ...prev, periodeId: e.target.value }))}
                className="form-input"
              >
                <option value="">-- Aucune --</option>
                {periodes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Jours de présence</label>
              <p className="text-xs text-gray-500 mb-2">Cliquez sur les cases pour activer/désactiver</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-xs font-medium text-gray-500"></th>
                      {JOURS_SEMAINE.filter(j => j !== 'mercredi').map((jour) => (
                        <th key={jour} className="p-2 text-xs font-medium text-gray-500 text-center">
                          {JOUR_LABELS[jour]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CRENEAUX.filter(c => c !== 'journee').map((creneau) => (
                      <tr key={creneau} className="border-t">
                        <td className="p-2 text-xs font-medium text-gray-600">
                          {CRENEAU_LABELS[creneau]}
                        </td>
                        {JOURS_SEMAINE.filter(j => j !== 'mercredi').map((jour) => (
                          <td key={`${jour}-${creneau}`} className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => toggleJourPresence(jour, creneau)}
                              className={`w-8 h-8 rounded border-2 transition-colors ${
                                isJourSelected(jour, creneau)
                                  ? 'bg-green-500 border-green-600 text-white'
                                  : 'bg-white border-gray-300 hover:border-green-400'
                              }`}
                            >
                              {isJourSelected(jour, creneau) && '✓'}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {affectationForm.joursPresence.length} créneau(x) sélectionné(s)
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <div></div>
          <div className="modal-footer-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Enregistrement...' : editingAffectation ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
