import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classes } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const classeId = parseInt(id)

    if (isNaN(classeId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [classe] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classeId))
      .limit(1)

    if (!classe) {
      return NextResponse.json({ error: 'Classe non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data: classe })
  } catch (error) {
    console.error('Error fetching classe:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const classeId = parseInt(id)

    if (isNaN(classeId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date(), updatedBy: user.id }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.ecoleId !== undefined) updateData.ecoleId = body.ecoleId
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    const [updated] = await db
      .update(classes)
      .set(updateData)
      .where(eq(classes.id, classeId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Classe non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating classe:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const classeId = parseInt(id)

    if (isNaN(classeId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(classes)
      .where(eq(classes.id, classeId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Classe non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting classe:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
