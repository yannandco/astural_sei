import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { titulaireAffectations, ecoles, classes } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const titulaireId = parseInt(id)

    if (isNaN(titulaireId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const data = await db
      .select({
        id: titulaireAffectations.id,
        titulaireId: titulaireAffectations.titulaireId,
        ecoleId: titulaireAffectations.ecoleId,
        classeId: titulaireAffectations.classeId,
        dateDebut: titulaireAffectations.dateDebut,
        dateFin: titulaireAffectations.dateFin,
        isActive: titulaireAffectations.isActive,
        ecoleName: ecoles.name,
        classeName: classes.name,
      })
      .from(titulaireAffectations)
      .leftJoin(ecoles, eq(titulaireAffectations.ecoleId, ecoles.id))
      .leftJoin(classes, eq(titulaireAffectations.classeId, classes.id))
      .where(eq(titulaireAffectations.titulaireId, titulaireId))
      .orderBy(desc(titulaireAffectations.dateDebut))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching affectations:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const titulaireId = parseInt(id)

    if (isNaN(titulaireId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { ecoleId, classeId, dateDebut, dateFin } = body

    if (!ecoleId) {
      return NextResponse.json({ error: "L'école est requise" }, { status: 400 })
    }

    const [created] = await db
      .insert(titulaireAffectations)
      .values({
        titulaireId,
        ecoleId,
        classeId: classeId || null,
        dateDebut: dateDebut || null,
        dateFin: dateFin || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating affectation:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
