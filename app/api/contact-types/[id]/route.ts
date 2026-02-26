import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contactTypes } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Get single contact type
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()
    const { id } = await params
    const typeId = parseInt(id)

    if (isNaN(typeId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [type] = await db
      .select()
      .from(contactTypes)
      .where(eq(contactTypes.id, typeId))
      .limit(1)

    if (!type) {
      return NextResponse.json({ error: 'Type non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: type })
  } catch (error) {
    console.error('Error fetching contact type:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH - Update contact type (admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const typeId = parseInt(id)

    if (isNaN(typeId)) {
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
      .update(contactTypes)
      .set(updateData)
      .where(eq(contactTypes.id, typeId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Type non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating contact type:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete contact type (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const typeId = parseInt(id)

    if (isNaN(typeId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(contactTypes)
      .where(eq(contactTypes.id, typeId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Type non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting contact type:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
