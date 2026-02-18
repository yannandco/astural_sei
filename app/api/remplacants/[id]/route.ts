import { NextRequest, NextResponse } from 'next/server'
import { eq, count, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacants, remplacantRemarques, seancesObservations } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [remplacant] = await db
      .select({
        id: remplacants.id,
        lastName: remplacants.lastName,
        firstName: remplacants.firstName,
        address: remplacants.address,
        phone: remplacants.phone,
        email: remplacants.email,
        isAvailable: remplacants.isAvailable,
        availabilityNote: remplacants.availabilityNote,
        contractStartDate: remplacants.contractStartDate,
        contractEndDate: remplacants.contractEndDate,
        obsTemporaire: remplacants.obsTemporaire,
        isActive: remplacants.isActive,
        createdAt: remplacants.createdAt,
        updatedAt: remplacants.updatedAt,
        remarquesCount: count(remplacantRemarques.id),
      })
      .from(remplacants)
      .leftJoin(remplacantRemarques, eq(remplacants.id, remplacantRemarques.remplacantId))
      .where(eq(remplacants.id, remplacantId))
      .groupBy(remplacants.id)
      .limit(1)

    if (!remplacant) {
      return NextResponse.json({ error: 'Remplaçant non trouvé' }, { status: 404 })
    }

    // Get séances d'observation count
    const [seancesCount] = await db
      .select({ count: count() })
      .from(seancesObservations)
      .where(eq(seancesObservations.remplacantObserveId, remplacantId))

    return NextResponse.json({
      data: {
        ...remplacant,
        seancesCount: seancesCount?.count || 0,
      },
    })
  } catch (error) {
    console.error('Error fetching remplacant:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date(), updatedBy: user.id }

    const stringFields = ['lastName', 'firstName', 'address', 'phone', 'email', 'availabilityNote', 'obsTemporaire'] as const
    for (const field of stringFields) {
      if (body[field] !== undefined) updateData[field] = body[field]?.trim() || null
    }

    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.isAvailable !== undefined) updateData.isAvailable = body.isAvailable
    if (body.contractStartDate !== undefined) updateData.contractStartDate = body.contractStartDate || null
    if (body.contractEndDate !== undefined) updateData.contractEndDate = body.contractEndDate || null

    const [updated] = await db
      .update(remplacants)
      .set(updateData)
      .where(eq(remplacants.id, remplacantId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Remplaçant non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating remplacant:', error)
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
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(remplacants)
      .where(eq(remplacants.id, remplacantId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Remplaçant non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting remplacant:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
