import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collaborateurEcoles } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string; affectationId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id, affectationId } = await params
    const collaborateurId = parseInt(id)
    const affId = parseInt(affectationId)

    if (isNaN(collaborateurId) || isNaN(affId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    // Verify the affectation belongs to this collaborateur
    const [existing] = await db
      .select()
      .from(collaborateurEcoles)
      .where(
        and(
          eq(collaborateurEcoles.id, affId),
          eq(collaborateurEcoles.collaborateurId, collaborateurId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Affectation non trouvée' }, { status: 404 })
    }

    const body = await request.json()
    const { ecoleId, classeId, periodeId, dateDebut, dateFin, joursPresence, isActive } = body

    // Serialize joursPresence to JSON string if it's an array
    const joursPresenceJson = Array.isArray(joursPresence)
      ? JSON.stringify(joursPresence)
      : joursPresence !== undefined
      ? joursPresence
      : undefined

    const updateData: Record<string, unknown> = {
      updatedBy: user.id,
      updatedAt: new Date(),
    }

    if (ecoleId !== undefined) updateData.ecoleId = ecoleId
    if (classeId !== undefined) updateData.classeId = classeId || null
    if (periodeId !== undefined) updateData.periodeId = periodeId || null
    if (dateDebut !== undefined) updateData.dateDebut = dateDebut || null
    if (dateFin !== undefined) updateData.dateFin = dateFin || null
    if (joursPresenceJson !== undefined) updateData.joursPresence = joursPresenceJson
    if (isActive !== undefined) updateData.isActive = isActive

    const [updated] = await db
      .update(collaborateurEcoles)
      .set(updateData)
      .where(eq(collaborateurEcoles.id, affId))
      .returning()

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating collaborateur-ecole:', error)
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

    const { id, affectationId } = await params
    const collaborateurId = parseInt(id)
    const affId = parseInt(affectationId)

    if (isNaN(collaborateurId) || isNaN(affId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    // Verify the affectation belongs to this collaborateur
    const [existing] = await db
      .select()
      .from(collaborateurEcoles)
      .where(
        and(
          eq(collaborateurEcoles.id, affId),
          eq(collaborateurEcoles.collaborateurId, collaborateurId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Affectation non trouvée' }, { status: 404 })
    }

    await db
      .delete(collaborateurEcoles)
      .where(eq(collaborateurEcoles.id, affId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting collaborateur-ecole:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
