import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { seancesObservations, remplacants, ecoles } from '@/lib/db/schema'
import { collaborateurs } from '@/lib/db/schema/collaborateurs'
import { requireRole, requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

const observateurRemplacants = alias(remplacants, 'observateur_remplacants')

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
        id: seancesObservations.id,
        remplacantObserveId: seancesObservations.remplacantObserveId,
        observateurType: seancesObservations.observateurType,
        observateurRemplacantId: seancesObservations.observateurRemplacantId,
        observateurCollaborateurId: seancesObservations.observateurCollaborateurId,
        ecoleId: seancesObservations.ecoleId,
        date: seancesObservations.date,
        creneau: seancesObservations.creneau,
        note: seancesObservations.note,
        createdAt: seancesObservations.createdAt,
        ecoleName: ecoles.name,
        observateurRemplacantLastName: observateurRemplacants.lastName,
        observateurRemplacantFirstName: observateurRemplacants.firstName,
        observateurCollaborateurLastName: collaborateurs.lastName,
        observateurCollaborateurFirstName: collaborateurs.firstName,
      })
      .from(seancesObservations)
      .innerJoin(ecoles, eq(seancesObservations.ecoleId, ecoles.id))
      .leftJoin(observateurRemplacants, eq(seancesObservations.observateurRemplacantId, observateurRemplacants.id))
      .leftJoin(collaborateurs, eq(seancesObservations.observateurCollaborateurId, collaborateurs.id))
      .where(eq(seancesObservations.remplacantObserveId, remplacantId))
      .orderBy(desc(seancesObservations.date))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching observations:', error)
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
    const { date, creneau, ecoleId, observateurType, observateurId, note } = body

    if (!date || !creneau || !ecoleId || !observateurType || !observateurId) {
      return NextResponse.json({ error: 'Tous les champs obligatoires doivent être remplis' }, { status: 400 })
    }

    if (!['remplacant', 'collaborateur'].includes(observateurType)) {
      return NextResponse.json({ error: 'Type d\'observateur invalide' }, { status: 400 })
    }

    const [created] = await db
      .insert(seancesObservations)
      .values({
        remplacantObserveId: remplacantId,
        observateurType,
        observateurRemplacantId: observateurType === 'remplacant' ? observateurId : null,
        observateurCollaborateurId: observateurType === 'collaborateur' ? observateurId : null,
        ecoleId,
        date,
        creneau,
        note: note?.trim() || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    // Fetch with joined data
    const [seance] = await db
      .select({
        id: seancesObservations.id,
        remplacantObserveId: seancesObservations.remplacantObserveId,
        observateurType: seancesObservations.observateurType,
        observateurRemplacantId: seancesObservations.observateurRemplacantId,
        observateurCollaborateurId: seancesObservations.observateurCollaborateurId,
        ecoleId: seancesObservations.ecoleId,
        date: seancesObservations.date,
        creneau: seancesObservations.creneau,
        note: seancesObservations.note,
        createdAt: seancesObservations.createdAt,
        ecoleName: ecoles.name,
        observateurRemplacantLastName: observateurRemplacants.lastName,
        observateurRemplacantFirstName: observateurRemplacants.firstName,
        observateurCollaborateurLastName: collaborateurs.lastName,
        observateurCollaborateurFirstName: collaborateurs.firstName,
      })
      .from(seancesObservations)
      .innerJoin(ecoles, eq(seancesObservations.ecoleId, ecoles.id))
      .leftJoin(observateurRemplacants, eq(seancesObservations.observateurRemplacantId, observateurRemplacants.id))
      .leftJoin(collaborateurs, eq(seancesObservations.observateurCollaborateurId, collaborateurs.id))
      .where(eq(seancesObservations.id, created.id))

    return NextResponse.json({ data: seance }, { status: 201 })
  } catch (error) {
    console.error('Error creating observation:', error)
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
    const seanceId = searchParams.get('seanceId')

    if (!seanceId) {
      return NextResponse.json({ error: 'ID séance requis' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(seancesObservations)
      .where(eq(seancesObservations.id, parseInt(seanceId)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Séance non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting observation:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
