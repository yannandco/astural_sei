import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collaborateurs, sectors } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const collabId = parseInt(id)

    if (isNaN(collabId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [collab] = await db
      .select({
        id: collaborateurs.id,
        lastName: collaborateurs.lastName,
        firstName: collaborateurs.firstName,
        address: collaborateurs.address,
        postalCode: collaborateurs.postalCode,
        city: collaborateurs.city,
        mobilePro: collaborateurs.mobilePro,
        email: collaborateurs.email,
        secteurId: collaborateurs.secteurId,
        taux: collaborateurs.taux,
        contratType: collaborateurs.contratType,
        contratDetails: collaborateurs.contratDetails,
        canton: collaborateurs.canton,
        pays: collaborateurs.pays,
        sexe: collaborateurs.sexe,
        dateSortie: collaborateurs.dateSortie,
        isActive: collaborateurs.isActive,
        createdAt: collaborateurs.createdAt,
        updatedAt: collaborateurs.updatedAt,
        secteurName: sectors.name,
      })
      .from(collaborateurs)
      .leftJoin(sectors, eq(collaborateurs.secteurId, sectors.id))
      .where(eq(collaborateurs.id, collabId))
      .limit(1)

    if (!collab) {
      return NextResponse.json({ error: 'Collaborateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: collab })
  } catch (error) {
    console.error('Error fetching collaborateur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const collabId = parseInt(id)

    if (isNaN(collabId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date(), updatedBy: user.id }

    const fields = ['lastName', 'firstName', 'address', 'postalCode', 'city', 'mobilePro', 'email', 'contratDetails', 'canton', 'pays'] as const
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]?.trim() || null
    }

    if (body.secteurId !== undefined) updateData.secteurId = body.secteurId || null
    if (body.taux !== undefined) updateData.taux = body.taux || null
    if (body.contratType !== undefined) updateData.contratType = body.contratType || null
    if (body.sexe !== undefined) updateData.sexe = body.sexe || null
    if (body.dateSortie !== undefined) updateData.dateSortie = body.dateSortie || null
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    const [updated] = await db
      .update(collaborateurs)
      .set(updateData)
      .where(eq(collaborateurs.id, collabId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Collaborateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating collaborateur:', error)
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
    const collabId = parseInt(id)

    if (isNaN(collabId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(collaborateurs)
      .where(eq(collaborateurs.id, collabId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Collaborateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting collaborateur:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
