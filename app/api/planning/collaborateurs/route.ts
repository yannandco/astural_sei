import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, asc, or, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  collaborateurs,
  remplacantAffectations,
  remplacants,
  ecoles,
  collaborateurEcoles,
  periodesScolaires,
  absences,
} from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

// GET - Planning des collaborateurs (présences + remplacements)
export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'user'])

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

    // 1. Récupérer tous les collaborateurs actifs
    const allCollaborateurs = await db
      .select({
        id: collaborateurs.id,
        lastName: collaborateurs.lastName,
        firstName: collaborateurs.firstName,
      })
      .from(collaborateurs)
      .where(eq(collaborateurs.isActive, true))
      .orderBy(asc(collaborateurs.lastName), asc(collaborateurs.firstName))

    // 2. Récupérer les affectations aux écoles (présences) qui chevauchent la période
    const allPresences = await db
      .select({
        id: collaborateurEcoles.id,
        collaborateurId: collaborateurEcoles.collaborateurId,
        ecoleId: collaborateurEcoles.ecoleId,
        ecoleName: ecoles.name,
        periodeId: collaborateurEcoles.periodeId,
        periodeCode: periodesScolaires.code,
        dateDebut: collaborateurEcoles.dateDebut,
        dateFin: collaborateurEcoles.dateFin,
        joursPresence: collaborateurEcoles.joursPresence,
      })
      .from(collaborateurEcoles)
      .leftJoin(ecoles, eq(collaborateurEcoles.ecoleId, ecoles.id))
      .leftJoin(periodesScolaires, eq(collaborateurEcoles.periodeId, periodesScolaires.id))
      .where(
        and(
          eq(collaborateurEcoles.isActive, true),
          // Filtrer par période scolaire active ou dates chevauchantes
          or(
            // Période scolaire couvre la plage demandée
            and(
              lte(periodesScolaires.dateDebut, endDate),
              gte(periodesScolaires.dateFin, startDate)
            ),
            // Ou pas de période mais dates chevauchantes
            and(
              isNull(collaborateurEcoles.periodeId),
              or(
                isNull(collaborateurEcoles.dateDebut),
                lte(collaborateurEcoles.dateDebut, endDate)
              ),
              or(
                isNull(collaborateurEcoles.dateFin),
                gte(collaborateurEcoles.dateFin, startDate)
              )
            )
          )
        )
      )

    // 3. Récupérer les remplacements qui chevauchent la période
    const allRemplacements = await db
      .select({
        id: remplacantAffectations.id,
        remplacantId: remplacantAffectations.remplacantId,
        remplacantNom: remplacants.lastName,
        remplacantPrenom: remplacants.firstName,
        collaborateurId: remplacantAffectations.collaborateurId,
        ecoleId: remplacantAffectations.ecoleId,
        ecoleNom: ecoles.name,
        dateDebut: remplacantAffectations.dateDebut,
        dateFin: remplacantAffectations.dateFin,
        creneau: remplacantAffectations.creneau,
        motif: remplacantAffectations.motif,
      })
      .from(remplacantAffectations)
      .leftJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
      .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
      .where(
        and(
          eq(remplacantAffectations.isActive, true),
          lte(remplacantAffectations.dateDebut, endDate),
          gte(remplacantAffectations.dateFin, startDate)
        )
      )

    // 4. Récupérer les absences de collaborateurs qui chevauchent la période
    const allAbsences = await db
      .select({
        id: absences.id,
        collaborateurId: absences.collaborateurId,
        dateDebut: absences.dateDebut,
        dateFin: absences.dateFin,
        creneau: absences.creneau,
        motif: absences.motif,
        motifDetails: absences.motifDetails,
      })
      .from(absences)
      .where(
        and(
          eq(absences.type, 'collaborateur'),
          eq(absences.isActive, true),
          lte(absences.dateDebut, endDate),
          gte(absences.dateFin, startDate)
        )
      )

    // Grouper par collaborateur
    const presencesByCollaborateur = new Map<number, typeof allPresences>()
    for (const p of allPresences) {
      const list = presencesByCollaborateur.get(p.collaborateurId) || []
      list.push(p)
      presencesByCollaborateur.set(p.collaborateurId, list)
    }

    const remplacementsByCollaborateur = new Map<number, typeof allRemplacements>()
    for (const r of allRemplacements) {
      const list = remplacementsByCollaborateur.get(r.collaborateurId) || []
      list.push(r)
      remplacementsByCollaborateur.set(r.collaborateurId, list)
    }

    const absencesByCollaborateur = new Map<number, typeof allAbsences>()
    for (const a of allAbsences) {
      if (a.collaborateurId === null) continue
      const list = absencesByCollaborateur.get(a.collaborateurId) || []
      list.push(a)
      absencesByCollaborateur.set(a.collaborateurId, list)
    }

    // Construire la réponse (seulement les collaborateurs qui ont des présences OU des remplacements)
    const collaborateursWithData = allCollaborateurs
      .filter((c) => presencesByCollaborateur.has(c.id) || remplacementsByCollaborateur.has(c.id))
      .map((c) => ({
        id: c.id,
        lastName: c.lastName,
        firstName: c.firstName,
        presences: presencesByCollaborateur.get(c.id) || [],
        remplacements: remplacementsByCollaborateur.get(c.id) || [],
        absences: absencesByCollaborateur.get(c.id) || [],
      }))

    return NextResponse.json({ data: collaborateursWithData })
  } catch (error) {
    console.error('Error fetching collaborateurs planning:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
