import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  remplacants,
  remplacantDisponibilitesPeriodes,
  remplacantDisponibilitesRecurrentes,
  remplacantDisponibilitesSpecifiques,
  remplacantAffectations,
  collaborateurs,
  ecoles,
  absences,
} from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth/server'

// GET - Vue globale du planning (tous les remplaçants)
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate et endDate requis' }, { status: 400 })
    }

    // Vérifier format dates
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json({ error: 'Format de date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    // 1. Récupérer tous les remplaçants actifs
    const allRemplacants = await db
      .select({
        id: remplacants.id,
        lastName: remplacants.lastName,
        firstName: remplacants.firstName,
        isAvailable: remplacants.isAvailable,
      })
      .from(remplacants)
      .where(eq(remplacants.isActive, true))
      .orderBy(asc(remplacants.lastName), asc(remplacants.firstName))

    // 2. Récupérer toutes les périodes actives qui chevauchent la plage demandée
    const allPeriodes = await db
      .select()
      .from(remplacantDisponibilitesPeriodes)
      .where(
        and(
          eq(remplacantDisponibilitesPeriodes.isActive, true),
          lte(remplacantDisponibilitesPeriodes.dateDebut, endDate),
          gte(remplacantDisponibilitesPeriodes.dateFin, startDate)
        )
      )

    // 3. Récupérer toutes les récurrences des périodes
    const periodeIds = allPeriodes.map((p) => p.id)
    const allRecurrentes = periodeIds.length > 0
      ? await db
          .select()
          .from(remplacantDisponibilitesRecurrentes)
          .where(
            eq(remplacantDisponibilitesRecurrentes.periodeId, periodeIds[0]) // Will be filtered below
          )
      : []

    // Actually fetch all recurrences for all periodes
    const allRecurrentesPromises = allPeriodes.map(async (periode) => {
      const recurrences = await db
        .select()
        .from(remplacantDisponibilitesRecurrentes)
        .where(eq(remplacantDisponibilitesRecurrentes.periodeId, periode.id))
      return { periodeId: periode.id, recurrences }
    })
    const recurrencesResults = await Promise.all(allRecurrentesPromises)

    // 4. Récupérer toutes les disponibilités spécifiques pour la période
    const allSpecifiques = await db
      .select()
      .from(remplacantDisponibilitesSpecifiques)
      .where(
        and(
          gte(remplacantDisponibilitesSpecifiques.date, startDate),
          lte(remplacantDisponibilitesSpecifiques.date, endDate)
        )
      )

    // 5. Récupérer toutes les affectations qui chevauchent la période
    const allAffectations = await db
      .select({
        id: remplacantAffectations.id,
        remplacantId: remplacantAffectations.remplacantId,
        collaborateurId: remplacantAffectations.collaborateurId,
        collaborateurNom: collaborateurs.lastName,
        collaborateurPrenom: collaborateurs.firstName,
        ecoleId: remplacantAffectations.ecoleId,
        ecoleNom: ecoles.name,
        dateDebut: remplacantAffectations.dateDebut,
        dateFin: remplacantAffectations.dateFin,
        creneau: remplacantAffectations.creneau,
        motif: remplacantAffectations.motif,
      })
      .from(remplacantAffectations)
      .leftJoin(collaborateurs, eq(remplacantAffectations.collaborateurId, collaborateurs.id))
      .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
      .where(
        and(
          eq(remplacantAffectations.isActive, true),
          lte(remplacantAffectations.dateDebut, endDate),
          gte(remplacantAffectations.dateFin, startDate)
        )
      )

    // 6. Récupérer les absences de remplaçants pour la période
    const allAbsences = await db
      .select({
        id: absences.id,
        remplacantId: absences.remplacantId,
        dateDebut: absences.dateDebut,
        dateFin: absences.dateFin,
        creneau: absences.creneau,
        motif: absences.motif,
        motifDetails: absences.motifDetails,
      })
      .from(absences)
      .where(
        and(
          eq(absences.type, 'remplacant'),
          eq(absences.isActive, true),
          lte(absences.dateDebut, endDate),
          gte(absences.dateFin, startDate)
        )
      )

    // Grouper par remplaçant
    const recurrencesByPeriode = new Map<number, typeof allRecurrentes>()
    for (const result of recurrencesResults) {
      recurrencesByPeriode.set(result.periodeId, result.recurrences)
    }

    const periodesByRemplacant = new Map<number, Array<{
      id: number
      remplacantId: number
      nom: string | null
      dateDebut: string
      dateFin: string
      isActive: boolean
      recurrences: Array<{
        id: number
        periodeId: number
        jourSemaine: string
        creneau: string
      }>
    }>>()

    for (const periode of allPeriodes) {
      const list = periodesByRemplacant.get(periode.remplacantId) || []
      list.push({
        id: periode.id,
        remplacantId: periode.remplacantId,
        nom: periode.nom,
        dateDebut: periode.dateDebut,
        dateFin: periode.dateFin,
        isActive: periode.isActive,
        recurrences: recurrencesByPeriode.get(periode.id) || [],
      })
      periodesByRemplacant.set(periode.remplacantId, list)
    }

    const specifiquesByRemplacant = new Map<number, typeof allSpecifiques>()
    for (const spec of allSpecifiques) {
      const list = specifiquesByRemplacant.get(spec.remplacantId) || []
      list.push(spec)
      specifiquesByRemplacant.set(spec.remplacantId, list)
    }

    const affectationsByRemplacant = new Map<number, typeof allAffectations>()
    for (const aff of allAffectations) {
      const list = affectationsByRemplacant.get(aff.remplacantId) || []
      list.push(aff)
      affectationsByRemplacant.set(aff.remplacantId, list)
    }

    const absencesByRemplacant = new Map<number, typeof allAbsences>()
    for (const a of allAbsences) {
      if (a.remplacantId === null) continue
      const list = absencesByRemplacant.get(a.remplacantId) || []
      list.push(a)
      absencesByRemplacant.set(a.remplacantId, list)
    }

    // Construire la réponse
    const data = allRemplacants.map((r) => ({
      id: r.id,
      lastName: r.lastName,
      firstName: r.firstName,
      isAvailable: r.isAvailable,
      periodes: periodesByRemplacant.get(r.id) || [],
      specifiques: specifiquesByRemplacant.get(r.id) || [],
      affectations: affectationsByRemplacant.get(r.id) || [],
      absences: absencesByRemplacant.get(r.id) || [],
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching planning:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
