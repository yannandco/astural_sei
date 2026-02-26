import { NextRequest, NextResponse } from 'next/server'
import { eq, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ecoles, etablissements, directeurs, classes, titulaireAffectations, collaborateurEcoles, titulaires } from '@/lib/db/schema'
import { collaborateurs } from '@/lib/db/schema/collaborateurs'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin', 'user'])
    const { id } = await params
    const ecoleId = parseInt(id)

    if (isNaN(ecoleId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [ecole] = await db
      .select({
        id: ecoles.id,
        name: ecoles.name,
        etablissementId: ecoles.etablissementId,
        directeurId: ecoles.directeurId,
        rue: ecoles.rue,
        codePostal: ecoles.codePostal,
        ville: ecoles.ville,
        phone: ecoles.phone,
        email: ecoles.email,
        remplacementApresJours: ecoles.remplacementApresJours,
        isActive: ecoles.isActive,
        createdAt: ecoles.createdAt,
        updatedAt: ecoles.updatedAt,
        etablissementName: etablissements.name,
        directeurLastName: directeurs.lastName,
        directeurFirstName: directeurs.firstName,
      })
      .from(ecoles)
      .leftJoin(etablissements, eq(ecoles.etablissementId, etablissements.id))
      .leftJoin(directeurs, eq(ecoles.directeurId, directeurs.id))
      .where(eq(ecoles.id, ecoleId))
      .limit(1)

    if (!ecole) {
      return NextResponse.json({ error: 'École non trouvée' }, { status: 404 })
    }

    const [classesCount] = await db.select({ value: count() }).from(classes).where(eq(classes.ecoleId, ecoleId))

    // Récupérer les titulaires affectés à cette école
    const titulairesAffectes = await db
      .select({
        id: titulaireAffectations.id,
        titulaireId: titulaireAffectations.titulaireId,
        lastName: titulaires.lastName,
        firstName: titulaires.firstName,
        joursPresence: titulaireAffectations.joursPresence,
        isActive: titulaireAffectations.isActive,
      })
      .from(titulaireAffectations)
      .innerJoin(titulaires, eq(titulaireAffectations.titulaireId, titulaires.id))
      .where(eq(titulaireAffectations.ecoleId, ecoleId))

    // Récupérer les collaborateurs affectés à cette école
    const collaborateursAffectes = await db
      .select({
        id: collaborateurEcoles.id,
        collaborateurId: collaborateurEcoles.collaborateurId,
        lastName: collaborateurs.lastName,
        firstName: collaborateurs.firstName,
        joursPresence: collaborateurEcoles.joursPresence,
        tauxCoIntervention: collaborateurEcoles.tauxCoIntervention,
        isActive: collaborateurEcoles.isActive,
      })
      .from(collaborateurEcoles)
      .innerJoin(collaborateurs, eq(collaborateurEcoles.collaborateurId, collaborateurs.id))
      .where(eq(collaborateurEcoles.ecoleId, ecoleId))

    return NextResponse.json({
      data: {
        ...ecole,
        classesCount: classesCount.value,
        titulaires: titulairesAffectes,
        collaborateurs: collaborateursAffectes,
      }
    })
  } catch (error) {
    console.error('Error fetching ecole:', error)
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
    const ecoleId = parseInt(id)

    if (isNaN(ecoleId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date(), updatedBy: user.id }

    const fields = ['name', 'rue', 'codePostal', 'ville', 'phone', 'email'] as const
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field]?.trim() || null
    }
    if (body.etablissementId !== undefined) updateData.etablissementId = body.etablissementId
    if (body.directeurId !== undefined) updateData.directeurId = body.directeurId || null
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.remplacementApresJours !== undefined) updateData.remplacementApresJours = body.remplacementApresJours === '' || body.remplacementApresJours === null ? null : String(body.remplacementApresJours)

    const [updated] = await db
      .update(ecoles)
      .set(updateData)
      .where(eq(ecoles.id, ecoleId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'École non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating ecole:', error)
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
    const ecoleId = parseInt(id)

    if (isNaN(ecoleId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(ecoles)
      .where(eq(ecoles.id, ecoleId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'École non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting ecole:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
