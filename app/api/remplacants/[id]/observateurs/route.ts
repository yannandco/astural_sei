import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantObservateurs, collaborateurs } from '@/lib/db/schema'
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

    const data = await db
      .select({
        id: remplacantObservateurs.id,
        collaborateurId: remplacantObservateurs.collaborateurId,
        collaborateurLastName: collaborateurs.lastName,
        collaborateurFirstName: collaborateurs.firstName,
        collaborateurEmail: collaborateurs.email,
        createdAt: remplacantObservateurs.createdAt,
      })
      .from(remplacantObservateurs)
      .innerJoin(collaborateurs, eq(remplacantObservateurs.collaborateurId, collaborateurs.id))
      .where(eq(remplacantObservateurs.remplacantId, remplacantId))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching observateurs:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { collaborateurId } = body

    if (!collaborateurId) {
      return NextResponse.json({ error: 'Le collaborateur est requis' }, { status: 400 })
    }

    // Check if already exists
    const [existing] = await db
      .select()
      .from(remplacantObservateurs)
      .where(
        and(
          eq(remplacantObservateurs.remplacantId, remplacantId),
          eq(remplacantObservateurs.collaborateurId, collaborateurId)
        )
      )
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: 'Ce collaborateur est déjà observateur' }, { status: 400 })
    }

    const [created] = await db
      .insert(remplacantObservateurs)
      .values({
        remplacantId,
        collaborateurId,
        createdBy: user.id,
      })
      .returning()

    // Fetch with collaborateur info
    const [observateur] = await db
      .select({
        id: remplacantObservateurs.id,
        collaborateurId: remplacantObservateurs.collaborateurId,
        collaborateurLastName: collaborateurs.lastName,
        collaborateurFirstName: collaborateurs.firstName,
        collaborateurEmail: collaborateurs.email,
        createdAt: remplacantObservateurs.createdAt,
      })
      .from(remplacantObservateurs)
      .innerJoin(collaborateurs, eq(remplacantObservateurs.collaborateurId, collaborateurs.id))
      .where(eq(remplacantObservateurs.id, created.id))

    return NextResponse.json({ data: observateur }, { status: 201 })
  } catch (error) {
    console.error('Error adding observateur:', error)
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

    const { searchParams } = new URL(request.url)
    const observateurId = searchParams.get('observateurId')

    if (!observateurId) {
      return NextResponse.json({ error: 'ID observateur requis' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(remplacantObservateurs)
      .where(eq(remplacantObservateurs.id, parseInt(observateurId)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Observateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing observateur:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
