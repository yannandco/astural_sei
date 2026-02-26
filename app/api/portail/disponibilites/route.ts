import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantDisponibilitesSpecifiques } from '@/lib/db/schema'
import { getPortailUser } from '@/lib/auth/server'

type Creneau = 'matin' | 'apres_midi' | 'journee'

// GET - Liste des disponibilités spécifiques du remplaçant connecté
export async function GET(request: NextRequest) {
  try {
    const portailUser = await getPortailUser()

    if (portailUser.role !== 'remplacant') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const remplacantId = portailUser.remplacant!.id
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const conditions = [eq(remplacantDisponibilitesSpecifiques.remplacantId, remplacantId)]

    if (startDate && endDate) {
      conditions.push(gte(remplacantDisponibilitesSpecifiques.date, startDate))
      conditions.push(lte(remplacantDisponibilitesSpecifiques.date, endDate))
    }

    const data = await db
      .select()
      .from(remplacantDisponibilitesSpecifiques)
      .where(and(...conditions))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching portail disponibilites:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer/modifier une disponibilité spécifique
export async function POST(request: NextRequest) {
  try {
    const portailUser = await getPortailUser()

    if (portailUser.role !== 'remplacant') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const remplacantId = portailUser.remplacant!.id
    const body = await request.json()
    const { date, creneau, isAvailable, note } = body

    if (!date || !creneau || isAvailable === undefined) {
      return NextResponse.json({ error: 'Date, créneau et disponibilité requis' }, { status: 400 })
    }

    const validCreneaux: Creneau[] = ['matin', 'apres_midi', 'journee']
    if (!validCreneaux.includes(creneau as Creneau)) {
      return NextResponse.json({ error: 'Créneau invalide' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Format de date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    const typedCreneau = creneau as Creneau

    // Check if entry already exists
    const existing = await db
      .select()
      .from(remplacantDisponibilitesSpecifiques)
      .where(and(
        eq(remplacantDisponibilitesSpecifiques.remplacantId, remplacantId),
        eq(remplacantDisponibilitesSpecifiques.date, date),
        eq(remplacantDisponibilitesSpecifiques.creneau, typedCreneau)
      ))
      .limit(1)

    let result
    if (existing.length > 0) {
      [result] = await db
        .update(remplacantDisponibilitesSpecifiques)
        .set({
          isAvailable,
          note: note || null,
          updatedBy: portailUser.user.id,
          updatedAt: new Date(),
        })
        .where(eq(remplacantDisponibilitesSpecifiques.id, existing[0].id))
        .returning()
    } else {
      [result] = await db
        .insert(remplacantDisponibilitesSpecifiques)
        .values({
          remplacantId,
          date,
          creneau: typedCreneau,
          isAvailable,
          note: note || null,
          createdBy: portailUser.user.id,
          updatedBy: portailUser.user.id,
        })
        .returning()
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('Error creating portail disponibilite:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une disponibilité spécifique
export async function DELETE(request: NextRequest) {
  try {
    const portailUser = await getPortailUser()

    if (portailUser.role !== 'remplacant') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const remplacantId = portailUser.remplacant!.id
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const creneau = searchParams.get('creneau')

    if (!date || !creneau) {
      return NextResponse.json({ error: 'Date et créneau requis' }, { status: 400 })
    }

    const typedCreneau = creneau as Creneau

    const [result] = await db
      .delete(remplacantDisponibilitesSpecifiques)
      .where(and(
        eq(remplacantDisponibilitesSpecifiques.remplacantId, remplacantId),
        eq(remplacantDisponibilitesSpecifiques.date, date),
        eq(remplacantDisponibilitesSpecifiques.creneau, typedCreneau)
      ))
      .returning()

    if (!result) {
      return NextResponse.json({ error: 'Disponibilité non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Error deleting portail disponibilite:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
