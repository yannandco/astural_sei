import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sectors } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin', 'user'])
    const { id } = await params
    const sectorId = parseInt(id)

    if (isNaN(sectorId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [sector] = await db
      .select()
      .from(sectors)
      .where(eq(sectors.id, sectorId))
      .limit(1)

    if (!sector) {
      return NextResponse.json({ error: 'Secteur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: sector })
  } catch (error) {
    console.error('Error fetching sector:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const sectorId = parseInt(id)

    if (isNaN(sectorId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, color, sortOrder, isActive } = body

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (color !== undefined) updateData.color = color || null
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (isActive !== undefined) updateData.isActive = isActive

    const [updated] = await db
      .update(sectors)
      .set(updateData)
      .where(eq(sectors.id, sectorId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Secteur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating sector:', error)
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
    const sectorId = parseInt(id)

    if (isNaN(sectorId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(sectors)
      .where(eq(sectors.id, sectorId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Secteur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sector:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
