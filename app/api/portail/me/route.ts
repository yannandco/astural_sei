import { NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  collaborateurs, remplacants, absences,
  remplacantAffectations, remplacantDisponibilitesSpecifiques,
  vacancesScolairesCache, ecoles, directeurs,
} from '@/lib/db/schema'
import { getPortailUser } from '@/lib/auth/server'

export async function GET() {
  try {
    const portailUser = await getPortailUser()

    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(today.getFullYear(), today.getMonth() + 4, 0).toISOString().split('T')[0]

    // Fetch vacances for both roles
    const vacancesData = await db
      .select()
      .from(vacancesScolairesCache)
      .where(and(
        lte(vacancesScolairesCache.dateDebut, endDate),
        gte(vacancesScolairesCache.dateFin, startDate)
      ))

    if (portailUser.role === 'collaborateur') {
      const collab = portailUser.collaborateur!
      const collaborateurId = collab.id

      // Fetch collaborateur's absences
      const absencesData = await db
        .select()
        .from(absences)
        .where(and(
          eq(absences.collaborateurId, collaborateurId),
          eq(absences.type, 'collaborateur'),
          eq(absences.isActive, true),
          lte(absences.dateDebut, endDate),
          gte(absences.dateFin, startDate)
        ))
        .orderBy(desc(absences.dateDebut))

      // Fetch remplacements (affectations on this collaborateur)
      const remplacementsData = await db
        .select({
          id: remplacantAffectations.id,
          remplacantId: remplacantAffectations.remplacantId,
          remplacantNom: remplacants.lastName,
          remplacantPrenom: remplacants.firstName,
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
        .where(and(
          eq(remplacantAffectations.collaborateurId, collaborateurId),
          eq(remplacantAffectations.isActive, true),
          lte(remplacantAffectations.dateDebut, endDate),
          gte(remplacantAffectations.dateFin, startDate)
        ))
        .orderBy(desc(remplacantAffectations.dateDebut))

      return NextResponse.json({
        data: {
          role: 'collaborateur',
          collaborateur: {
            id: collab.id,
            firstName: collab.firstName,
            lastName: collab.lastName,
            email: collab.email,
          },
          absences: absencesData,
          remplacements: remplacementsData,
          vacances: vacancesData,
        },
      })
    }

    // Remplaçant
    const remp = portailUser.remplacant!
    const remplacantId = remp.id

    // Fetch specifiques
    const specifiquesData = await db
      .select()
      .from(remplacantDisponibilitesSpecifiques)
      .where(and(
        eq(remplacantDisponibilitesSpecifiques.remplacantId, remplacantId),
        gte(remplacantDisponibilitesSpecifiques.date, startDate),
        lte(remplacantDisponibilitesSpecifiques.date, endDate)
      ))

    // Fetch affectations
    const affectationsData = await db
      .select({
        id: remplacantAffectations.id,
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
      .where(and(
        eq(remplacantAffectations.remplacantId, remplacantId),
        eq(remplacantAffectations.isActive, true),
        lte(remplacantAffectations.dateDebut, endDate),
        gte(remplacantAffectations.dateFin, startDate)
      ))
      .orderBy(desc(remplacantAffectations.dateDebut))

    // Fetch remplacant absences
    const absencesData = await db
      .select()
      .from(absences)
      .where(and(
        eq(absences.remplacantId, remplacantId),
        eq(absences.type, 'remplacant'),
        eq(absences.isActive, true),
        lte(absences.dateDebut, endDate),
        gte(absences.dateFin, startDate)
      ))
      .orderBy(desc(absences.dateDebut))

    return NextResponse.json({
      data: {
        role: 'remplacant',
        remplacant: {
          id: remp.id,
          firstName: remp.firstName,
          lastName: remp.lastName,
          email: remp.email,
        },
        specifiques: specifiquesData,
        affectations: affectationsData,
        absences: absencesData,
        vacances: vacancesData,
      },
    })
  } catch (error) {
    console.error('Error fetching portail me:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
