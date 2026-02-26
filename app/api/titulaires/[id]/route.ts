import { NextRequest, NextResponse } from 'next/server'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { titulaires, titulaireAffectations, titulaireRemplacements, ecoles, classes, collaborateurEcoles, collaborateurs } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()
    const { id } = await params
    const titulaireId = parseInt(id)

    if (isNaN(titulaireId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [titulaire] = await db
      .select()
      .from(titulaires)
      .where(eq(titulaires.id, titulaireId))
      .limit(1)

    if (!titulaire) {
      return NextResponse.json({ error: 'Titulaire non trouvé' }, { status: 404 })
    }

    const rawAffectations = await db
      .select({
        id: titulaireAffectations.id,
        ecoleId: titulaireAffectations.ecoleId,
        classeId: titulaireAffectations.classeId,
        dateDebut: titulaireAffectations.dateDebut,
        dateFin: titulaireAffectations.dateFin,
        isActive: titulaireAffectations.isActive,
        ecoleName: ecoles.name,
        classeName: classes.name,
      })
      .from(titulaireAffectations)
      .leftJoin(ecoles, eq(titulaireAffectations.ecoleId, ecoles.id))
      .leftJoin(classes, eq(titulaireAffectations.classeId, classes.id))
      .where(eq(titulaireAffectations.titulaireId, titulaireId))
      .orderBy(desc(titulaireAffectations.dateDebut))

    // Pour chaque affectation, chercher le(s) collaborateur(s) intervenant(s) sur la même école
    const affectations = await Promise.all(
      rawAffectations.map(async (aff) => {
        const intervenants = await db
          .select({
            collaborateurId: collaborateurs.id,
            firstName: collaborateurs.firstName,
            lastName: collaborateurs.lastName,
          })
          .from(collaborateurEcoles)
          .innerJoin(collaborateurs, eq(collaborateurEcoles.collaborateurId, collaborateurs.id))
          .where(and(
            eq(collaborateurEcoles.ecoleId, aff.ecoleId),
            eq(collaborateurEcoles.isActive, true)
          ))

        return {
          ...aff,
          intervenants,
        }
      })
    )

    const remplacements = await db
      .select()
      .from(titulaireRemplacements)
      .where(eq(titulaireRemplacements.titulaireOriginalId, titulaireId))
      .orderBy(desc(titulaireRemplacements.dateDebut))

    return NextResponse.json({
      data: {
        ...titulaire,
        affectations,
        remplacements,
      }
    })
  } catch (error) {
    console.error('Error fetching titulaire:', error)
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
    const titulaireId = parseInt(id)

    if (isNaN(titulaireId)) {
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
      .update(titulaires)
      .set(updateData)
      .where(eq(titulaires.id, titulaireId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Titulaire non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating titulaire:', error)
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
    const titulaireId = parseInt(id)

    if (isNaN(titulaireId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(titulaires)
      .where(eq(titulaires.id, titulaireId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Titulaire non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting titulaire:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
