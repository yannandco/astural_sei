import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantAffectations, remplacants, ecoles } from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Liste des remplacements pour un collaborateur
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let conditions = [
      eq(remplacantAffectations.collaborateurId, collaborateurId),
      eq(remplacantAffectations.isActive, true),
    ]

    if (startDate && endDate) {
      // Affectations qui chevauchent la période
      conditions.push(lte(remplacantAffectations.dateDebut, endDate))
      conditions.push(gte(remplacantAffectations.dateFin, startDate))
    }

    const data = await db
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
        createdAt: remplacantAffectations.createdAt,
      })
      .from(remplacantAffectations)
      .leftJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
      .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
      .where(and(...conditions))
      .orderBy(desc(remplacantAffectations.dateDebut))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching remplacements:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
