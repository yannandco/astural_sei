import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { directeurRemplacements, directeurs, ecoles } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin', 'user'])

    const { id } = await params
    const directeurId = parseInt(id)

    if (isNaN(directeurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const data = await db
      .select()
      .from(directeurRemplacements)
      .where(eq(directeurRemplacements.directeurOriginalId, directeurId))
      .orderBy(desc(directeurRemplacements.dateDebut))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching remplacements:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const directeurId = parseInt(id)

    if (isNaN(directeurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { ecoleId, remplacantDirecteurId, dateDebut, dateFin, motif } = body

    if (!ecoleId || !remplacantDirecteurId || !dateDebut) {
      return NextResponse.json({ error: 'École, remplaçant et date de début sont requis' }, { status: 400 })
    }

    const [created] = await db
      .insert(directeurRemplacements)
      .values({
        ecoleId,
        directeurOriginalId: directeurId,
        remplacantDirecteurId,
        dateDebut,
        dateFin: dateFin || null,
        motif: motif?.trim() || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating remplacement:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
