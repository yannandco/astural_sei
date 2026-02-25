import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantDisponibilitesSpecifiques } from '@/lib/db/schema'
import { requireAuth, requireAdminOrSelfRemplacant } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

type Creneau = 'matin' | 'apres_midi' | 'journee'

// GET - Liste des disponibilités spécifiques du remplaçant
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = db
      .select()
      .from(remplacantDisponibilitesSpecifiques)
      .where(eq(remplacantDisponibilitesSpecifiques.remplacantId, remplacantId))

    // Filtrer par plage de dates si spécifiée
    if (startDate && endDate) {
      query = db
        .select()
        .from(remplacantDisponibilitesSpecifiques)
        .where(
          and(
            eq(remplacantDisponibilitesSpecifiques.remplacantId, remplacantId),
            gte(remplacantDisponibilitesSpecifiques.date, startDate),
            lte(remplacantDisponibilitesSpecifiques.date, endDate)
          )
        )
    }

    const data = await query

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching disponibilités spécifiques:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Ajouter une disponibilité spécifique (exception ou ajout ponctuel)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { user } = await requireAdminOrSelfRemplacant(remplacantId)

    const body = await request.json()
    const { date, creneau, isAvailable, note } = body

    if (!date || !creneau || isAvailable === undefined) {
      return NextResponse.json({ error: 'Date, créneau et disponibilité requis' }, { status: 400 })
    }

    const validCreneaux: Creneau[] = ['matin', 'apres_midi', 'journee']
    if (!validCreneaux.includes(creneau as Creneau)) {
      return NextResponse.json({ error: 'Créneau invalide' }, { status: 400 })
    }

    // Vérifier format date (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Format de date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    const typedCreneau = creneau as Creneau

    // Vérifier si une entrée existe déjà pour cette date/créneau
    const existing = await db
      .select()
      .from(remplacantDisponibilitesSpecifiques)
      .where(
        and(
          eq(remplacantDisponibilitesSpecifiques.remplacantId, remplacantId),
          eq(remplacantDisponibilitesSpecifiques.date, date),
          eq(remplacantDisponibilitesSpecifiques.creneau, typedCreneau)
        )
      )
      .limit(1)

    let result
    if (existing.length > 0) {
      // Mettre à jour l'existant
      [result] = await db
        .update(remplacantDisponibilitesSpecifiques)
        .set({
          isAvailable,
          note: note || null,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(remplacantDisponibilitesSpecifiques.id, existing[0].id))
        .returning()
    } else {
      // Créer nouveau
      [result] = await db
        .insert(remplacantDisponibilitesSpecifiques)
        .values({
          remplacantId,
          date,
          creneau: typedCreneau,
          isAvailable,
          note: note || null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning()
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('Error creating disponibilité spécifique:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une disponibilité spécifique
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    await requireAdminOrSelfRemplacant(remplacantId)

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const creneau = searchParams.get('creneau')

    if (!date || !creneau) {
      return NextResponse.json({ error: 'Date et créneau requis' }, { status: 400 })
    }

    const typedCreneau = creneau as Creneau

    // Hard delete: supprimer l'entrée
    const [result] = await db
      .delete(remplacantDisponibilitesSpecifiques)
      .where(
        and(
          eq(remplacantDisponibilitesSpecifiques.remplacantId, remplacantId),
          eq(remplacantDisponibilitesSpecifiques.date, date),
          eq(remplacantDisponibilitesSpecifiques.creneau, typedCreneau)
        )
      )
      .returning()

    if (!result) {
      return NextResponse.json({ error: 'Disponibilité non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Error deleting disponibilité spécifique:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
