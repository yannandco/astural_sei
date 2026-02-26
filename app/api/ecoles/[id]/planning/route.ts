import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collaborateurEcoles, collaborateurs, remplacantAffectations, remplacants } from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Planning de l'école (collaborateurs présents + remplacements)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const ecoleId = parseInt(id)

    if (isNaN(ecoleId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Récupérer les collaborateurs affectés à cette école
    const collaborateursData = await db
      .select({
        id: collaborateurEcoles.id,
        collaborateurId: collaborateurEcoles.collaborateurId,
        lastName: collaborateurs.lastName,
        firstName: collaborateurs.firstName,
        joursPresence: collaborateurEcoles.joursPresence,
        isActive: collaborateurEcoles.isActive,
      })
      .from(collaborateurEcoles)
      .innerJoin(collaborateurs, eq(collaborateurEcoles.collaborateurId, collaborateurs.id))
      .where(
        and(
          eq(collaborateurEcoles.ecoleId, ecoleId),
          eq(collaborateurEcoles.isActive, true)
        )
      )

    // Récupérer les remplacements pour cette école
    let remplacementsConditions = [
      eq(remplacantAffectations.ecoleId, ecoleId),
      eq(remplacantAffectations.isActive, true),
    ]

    if (startDate && endDate) {
      remplacementsConditions.push(lte(remplacantAffectations.dateDebut, endDate))
      remplacementsConditions.push(gte(remplacantAffectations.dateFin, startDate))
    }

    const remplacementsData = await db
      .select({
        id: remplacantAffectations.id,
        remplacantId: remplacantAffectations.remplacantId,
        remplacantNom: remplacants.lastName,
        remplacantPrenom: remplacants.firstName,
        collaborateurId: remplacantAffectations.collaborateurId,
        collaborateurNom: collaborateurs.lastName,
        collaborateurPrenom: collaborateurs.firstName,
        dateDebut: remplacantAffectations.dateDebut,
        dateFin: remplacantAffectations.dateFin,
        creneau: remplacantAffectations.creneau,
        motif: remplacantAffectations.motif,
      })
      .from(remplacantAffectations)
      .innerJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
      .leftJoin(collaborateurs, eq(remplacantAffectations.collaborateurId, collaborateurs.id))
      .where(and(...remplacementsConditions))

    return NextResponse.json({
      data: {
        collaborateurs: collaborateursData,
        remplacements: remplacementsData,
      }
    })
  } catch (error) {
    console.error('Error fetching ecole planning:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
