import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { periodesScolaires } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Récupérer une période
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const periodeId = parseInt(id)

    if (isNaN(periodeId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [periode] = await db
      .select()
      .from(periodesScolaires)
      .where(eq(periodesScolaires.id, periodeId))
      .limit(1)

    if (!periode) {
      return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data: periode })
  } catch (error) {
    console.error('Error fetching période:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH - Modifier une période
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const periodeId = parseInt(id)

    if (isNaN(periodeId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { code, label, dateDebut, dateFin, isActive } = body

    const updates: Record<string, unknown> = {}
    if (code !== undefined) updates.code = code.toUpperCase()
    if (label !== undefined) updates.label = label
    if (dateDebut !== undefined) updates.dateDebut = dateDebut
    if (dateFin !== undefined) updates.dateFin = dateFin
    if (isActive !== undefined) updates.isActive = isActive

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    const [updated] = await db
      .update(periodesScolaires)
      .set(updates)
      .where(eq(periodesScolaires.id, periodeId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating période:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une période
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const periodeId = parseInt(id)

    if (isNaN(periodeId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(periodesScolaires)
      .where(eq(periodesScolaires.id, periodeId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data: deleted })
  } catch (error) {
    console.error('Error deleting période:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
