import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantDisponibilitesPeriodes, remplacantDisponibilitesRecurrentes } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

type JourSemaine = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi'
type Creneau = 'matin' | 'apres_midi' | 'journee'

// GET - Liste des disponibilités récurrentes actives pour une date donnée
// Retourne les récurrences des périodes qui couvrent la date demandée
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // Format YYYY-MM-DD

    // Récupérer les périodes actives
    let periodesQuery = db
      .select()
      .from(remplacantDisponibilitesPeriodes)
      .where(
        and(
          eq(remplacantDisponibilitesPeriodes.remplacantId, remplacantId),
          eq(remplacantDisponibilitesPeriodes.isActive, true)
        )
      )

    // Si une date est fournie, filtrer les périodes qui la couvrent
    if (date) {
      periodesQuery = db
        .select()
        .from(remplacantDisponibilitesPeriodes)
        .where(
          and(
            eq(remplacantDisponibilitesPeriodes.remplacantId, remplacantId),
            eq(remplacantDisponibilitesPeriodes.isActive, true),
            lte(remplacantDisponibilitesPeriodes.dateDebut, date),
            gte(remplacantDisponibilitesPeriodes.dateFin, date)
          )
        )
    }

    const periodes = await periodesQuery

    // Récupérer toutes les récurrences de ces périodes
    const recurrences = []
    for (const periode of periodes) {
      const periodRecurrences = await db
        .select({
          id: remplacantDisponibilitesRecurrentes.id,
          periodeId: remplacantDisponibilitesRecurrentes.periodeId,
          jourSemaine: remplacantDisponibilitesRecurrentes.jourSemaine,
          creneau: remplacantDisponibilitesRecurrentes.creneau,
          periodeNom: remplacantDisponibilitesPeriodes.nom,
          periodeDebut: remplacantDisponibilitesPeriodes.dateDebut,
          periodeFin: remplacantDisponibilitesPeriodes.dateFin,
        })
        .from(remplacantDisponibilitesRecurrentes)
        .innerJoin(
          remplacantDisponibilitesPeriodes,
          eq(remplacantDisponibilitesRecurrentes.periodeId, remplacantDisponibilitesPeriodes.id)
        )
        .where(eq(remplacantDisponibilitesRecurrentes.periodeId, periode.id))

      recurrences.push(...periodRecurrences)
    }

    return NextResponse.json({ data: recurrences })
  } catch (error) {
    console.error('Error fetching disponibilités récurrentes:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Ajouter une récurrence à une période existante
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { periodeId, jourSemaine, creneau } = body

    if (!periodeId || !jourSemaine || !creneau) {
      return NextResponse.json({ error: 'Période, jour et créneau requis' }, { status: 400 })
    }

    const validJours: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']
    const validCreneaux: Creneau[] = ['matin', 'apres_midi', 'journee']

    if (!validJours.includes(jourSemaine as JourSemaine)) {
      return NextResponse.json({ error: 'Jour invalide' }, { status: 400 })
    }

    if (!validCreneaux.includes(creneau as Creneau)) {
      return NextResponse.json({ error: 'Créneau invalide' }, { status: 400 })
    }

    // Vérifier que la période existe et appartient au remplaçant
    const [periode] = await db
      .select()
      .from(remplacantDisponibilitesPeriodes)
      .where(
        and(
          eq(remplacantDisponibilitesPeriodes.id, periodeId),
          eq(remplacantDisponibilitesPeriodes.remplacantId, remplacantId)
        )
      )
      .limit(1)

    if (!periode) {
      return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 })
    }

    // Vérifier si la récurrence existe déjà
    const [existing] = await db
      .select()
      .from(remplacantDisponibilitesRecurrentes)
      .where(
        and(
          eq(remplacantDisponibilitesRecurrentes.periodeId, periodeId),
          eq(remplacantDisponibilitesRecurrentes.jourSemaine, jourSemaine as JourSemaine),
          eq(remplacantDisponibilitesRecurrentes.creneau, creneau as Creneau)
        )
      )
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: 'Cette récurrence existe déjà' }, { status: 409 })
    }

    // Créer la récurrence
    const [result] = await db
      .insert(remplacantDisponibilitesRecurrentes)
      .values({
        periodeId,
        jourSemaine: jourSemaine as JourSemaine,
        creneau: creneau as Creneau,
      })
      .returning()

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('Error creating disponibilité récurrente:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une récurrence
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const recurrenceId = searchParams.get('recurrenceId')
    const periodeId = searchParams.get('periodeId')
    const jourSemaine = searchParams.get('jourSemaine')
    const creneau = searchParams.get('creneau')

    // Suppression par ID
    if (recurrenceId) {
      // Vérifier que la récurrence appartient à une période du remplaçant
      const [recurrence] = await db
        .select({
          id: remplacantDisponibilitesRecurrentes.id,
          remplacantId: remplacantDisponibilitesPeriodes.remplacantId,
        })
        .from(remplacantDisponibilitesRecurrentes)
        .innerJoin(
          remplacantDisponibilitesPeriodes,
          eq(remplacantDisponibilitesRecurrentes.periodeId, remplacantDisponibilitesPeriodes.id)
        )
        .where(eq(remplacantDisponibilitesRecurrentes.id, parseInt(recurrenceId)))
        .limit(1)

      if (!recurrence || recurrence.remplacantId !== remplacantId) {
        return NextResponse.json({ error: 'Récurrence non trouvée' }, { status: 404 })
      }

      const [deleted] = await db
        .delete(remplacantDisponibilitesRecurrentes)
        .where(eq(remplacantDisponibilitesRecurrentes.id, parseInt(recurrenceId)))
        .returning()

      return NextResponse.json({ data: deleted })
    }

    // Suppression par période + jour + créneau
    if (periodeId && jourSemaine && creneau) {
      // Vérifier que la période appartient au remplaçant
      const [periode] = await db
        .select()
        .from(remplacantDisponibilitesPeriodes)
        .where(
          and(
            eq(remplacantDisponibilitesPeriodes.id, parseInt(periodeId)),
            eq(remplacantDisponibilitesPeriodes.remplacantId, remplacantId)
          )
        )
        .limit(1)

      if (!periode) {
        return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 })
      }

      const [deleted] = await db
        .delete(remplacantDisponibilitesRecurrentes)
        .where(
          and(
            eq(remplacantDisponibilitesRecurrentes.periodeId, parseInt(periodeId)),
            eq(remplacantDisponibilitesRecurrentes.jourSemaine, jourSemaine as JourSemaine),
            eq(remplacantDisponibilitesRecurrentes.creneau, creneau as Creneau)
          )
        )
        .returning()

      if (!deleted) {
        return NextResponse.json({ error: 'Récurrence non trouvée' }, { status: 404 })
      }

      return NextResponse.json({ data: deleted })
    }

    return NextResponse.json({ error: 'Paramètres insuffisants' }, { status: 400 })
  } catch (error) {
    console.error('Error deleting disponibilité récurrente:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
