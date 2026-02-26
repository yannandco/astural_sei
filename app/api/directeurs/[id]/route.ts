import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { directeurs, ecoles, directeurRemplacements } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin', 'user'])
    const { id } = await params
    const directeurId = parseInt(id)

    if (isNaN(directeurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [directeur] = await db
      .select()
      .from(directeurs)
      .where(eq(directeurs.id, directeurId))
      .limit(1)

    if (!directeur) {
      return NextResponse.json({ error: 'Directeur non trouvé' }, { status: 404 })
    }

    const ecolesActuelles = await db
      .select({
        id: ecoles.id,
        name: ecoles.name,
        etablissementId: ecoles.etablissementId,
      })
      .from(ecoles)
      .where(eq(ecoles.directeurId, directeurId))

    const remplacements = await db
      .select()
      .from(directeurRemplacements)
      .where(eq(directeurRemplacements.directeurOriginalId, directeurId))
      .orderBy(desc(directeurRemplacements.dateDebut))

    return NextResponse.json({
      data: {
        ...directeur,
        ecoles: ecolesActuelles,
        remplacements,
      }
    })
  } catch (error) {
    console.error('Error fetching directeur:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const directeurId = parseInt(id)

    if (isNaN(directeurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date(), updatedBy: user.id }

    const fields = ['lastName', 'firstName', 'email', 'phone'] as const
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]?.trim() || null
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    const [updated] = await db
      .update(directeurs)
      .set(updateData)
      .where(eq(directeurs.id, directeurId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Directeur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating directeur:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const directeurId = parseInt(id)

    if (isNaN(directeurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(directeurs)
      .where(eq(directeurs.id, directeurId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Directeur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting directeur:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
