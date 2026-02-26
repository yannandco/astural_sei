import { NextRequest, NextResponse } from 'next/server'
import { eq, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { etablissements, ecoles, directeurs } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin', 'user'])
    const { id } = await params
    const etabId = parseInt(id)

    if (isNaN(etabId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [etab] = await db
      .select({
        id: etablissements.id,
        name: etablissements.name,
        address: etablissements.address,
        postalCode: etablissements.postalCode,
        city: etablissements.city,
        phone: etablissements.phone,
        email: etablissements.email,
        directeurId: etablissements.directeurId,
        directeurLastName: directeurs.lastName,
        directeurFirstName: directeurs.firstName,
        isActive: etablissements.isActive,
        createdAt: etablissements.createdAt,
        updatedAt: etablissements.updatedAt,
        ecolesCount: count(ecoles.id),
      })
      .from(etablissements)
      .leftJoin(directeurs, eq(etablissements.directeurId, directeurs.id))
      .leftJoin(ecoles, eq(etablissements.id, ecoles.etablissementId))
      .where(eq(etablissements.id, etabId))
      .groupBy(etablissements.id, directeurs.lastName, directeurs.firstName)
      .limit(1)

    if (!etab) {
      return NextResponse.json({ error: 'Établissement non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: etab })
  } catch (error) {
    console.error('Error fetching etablissement:', error)
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
    const etabId = parseInt(id)

    if (isNaN(etabId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date(), updatedBy: user.id }

    const fields = ['name', 'address', 'postalCode', 'city', 'phone', 'email'] as const
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]?.trim() || null
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.directeurId !== undefined) updateData.directeurId = body.directeurId || null

    const [updated] = await db
      .update(etablissements)
      .set(updateData)
      .where(eq(etablissements.id, etabId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Établissement non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating etablissement:', error)
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
    const etabId = parseInt(id)

    if (isNaN(etabId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(etablissements)
      .where(eq(etablissements.id, etabId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Établissement non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting etablissement:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
