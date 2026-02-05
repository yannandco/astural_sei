import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantDisponibilitesPeriodes, remplacantDisponibilitesRecurrentes } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

type JourSemaine = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi'
type Creneau = 'matin' | 'apres_midi' | 'journee'

interface RecurrenceInput {
  jourSemaine: JourSemaine
  creneau: Creneau
}

// GET - Liste des périodes avec leurs récurrences
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    // Récupérer toutes les périodes actives
    const periodes = await db
      .select()
      .from(remplacantDisponibilitesPeriodes)
      .where(
        and(
          eq(remplacantDisponibilitesPeriodes.remplacantId, remplacantId),
          eq(remplacantDisponibilitesPeriodes.isActive, true)
        )
      )
      .orderBy(desc(remplacantDisponibilitesPeriodes.dateDebut))

    // Pour chaque période, récupérer ses récurrences
    const periodesWithRecurrences = await Promise.all(
      periodes.map(async (periode) => {
        const recurrences = await db
          .select()
          .from(remplacantDisponibilitesRecurrentes)
          .where(eq(remplacantDisponibilitesRecurrentes.periodeId, periode.id))

        return {
          ...periode,
          recurrences,
        }
      })
    )

    return NextResponse.json({ data: periodesWithRecurrences })
  } catch (error) {
    console.error('Error fetching périodes:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer une nouvelle période avec ses récurrences
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { nom, dateDebut, dateFin, recurrences } = body as {
      nom?: string
      dateDebut: string
      dateFin: string
      recurrences: RecurrenceInput[]
    }

    if (!dateDebut || !dateFin) {
      return NextResponse.json({ error: 'Dates de début et fin requises' }, { status: 400 })
    }

    // Vérifier format dates
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(dateFin)) {
      return NextResponse.json({ error: 'Format de date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    if (dateDebut > dateFin) {
      return NextResponse.json({ error: 'La date de début doit être avant la date de fin' }, { status: 400 })
    }

    // Créer la période
    const [periode] = await db
      .insert(remplacantDisponibilitesPeriodes)
      .values({
        remplacantId,
        nom: nom || null,
        dateDebut,
        dateFin,
        isActive: true,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    // Créer les récurrences si fournies
    const createdRecurrences = []
    if (recurrences && recurrences.length > 0) {
      const validJours: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']
      const validCreneaux: Creneau[] = ['matin', 'apres_midi', 'journee']

      for (const rec of recurrences) {
        if (validJours.includes(rec.jourSemaine) && validCreneaux.includes(rec.creneau)) {
          const [created] = await db
            .insert(remplacantDisponibilitesRecurrentes)
            .values({
              periodeId: periode.id,
              jourSemaine: rec.jourSemaine,
              creneau: rec.creneau,
            })
            .returning()
          createdRecurrences.push(created)
        }
      }
    }

    return NextResponse.json({
      data: {
        ...periode,
        recurrences: createdRecurrences,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating période:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH - Modifier une période et ses récurrences
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { periodeId, nom, dateDebut, dateFin, recurrences } = body as {
      periodeId: number
      nom?: string
      dateDebut?: string
      dateFin?: string
      recurrences?: RecurrenceInput[]
    }

    if (!periodeId) {
      return NextResponse.json({ error: 'ID de période requis' }, { status: 400 })
    }

    // Vérifier que la période existe et appartient au remplaçant
    const [existing] = await db
      .select()
      .from(remplacantDisponibilitesPeriodes)
      .where(
        and(
          eq(remplacantDisponibilitesPeriodes.id, periodeId),
          eq(remplacantDisponibilitesPeriodes.remplacantId, remplacantId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 })
    }

    // Mettre à jour la période
    const updates: Record<string, unknown> = {
      updatedBy: user.id,
      updatedAt: new Date(),
    }

    if (nom !== undefined) updates.nom = nom || null
    if (dateDebut) updates.dateDebut = dateDebut
    if (dateFin) updates.dateFin = dateFin

    const [updated] = await db
      .update(remplacantDisponibilitesPeriodes)
      .set(updates)
      .where(eq(remplacantDisponibilitesPeriodes.id, periodeId))
      .returning()

    // Si recurrences est fourni, remplacer toutes les récurrences
    let updatedRecurrences = []
    if (recurrences !== undefined) {
      // Supprimer les anciennes récurrences
      await db
        .delete(remplacantDisponibilitesRecurrentes)
        .where(eq(remplacantDisponibilitesRecurrentes.periodeId, periodeId))

      // Créer les nouvelles
      const validJours: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']
      const validCreneaux: Creneau[] = ['matin', 'apres_midi', 'journee']

      for (const rec of recurrences) {
        if (validJours.includes(rec.jourSemaine) && validCreneaux.includes(rec.creneau)) {
          const [created] = await db
            .insert(remplacantDisponibilitesRecurrentes)
            .values({
              periodeId,
              jourSemaine: rec.jourSemaine,
              creneau: rec.creneau,
            })
            .returning()
          updatedRecurrences.push(created)
        }
      }
    } else {
      // Récupérer les récurrences existantes
      updatedRecurrences = await db
        .select()
        .from(remplacantDisponibilitesRecurrentes)
        .where(eq(remplacantDisponibilitesRecurrentes.periodeId, periodeId))
    }

    return NextResponse.json({
      data: {
        ...updated,
        recurrences: updatedRecurrences,
      }
    })
  } catch (error) {
    console.error('Error updating période:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une période (et ses récurrences en cascade)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const periodeId = searchParams.get('periodeId')

    if (!periodeId) {
      return NextResponse.json({ error: 'ID de période requis' }, { status: 400 })
    }

    // Vérifier que la période existe et appartient au remplaçant
    const [existing] = await db
      .select()
      .from(remplacantDisponibilitesPeriodes)
      .where(
        and(
          eq(remplacantDisponibilitesPeriodes.id, parseInt(periodeId)),
          eq(remplacantDisponibilitesPeriodes.remplacantId, remplacantId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 })
    }

    // Hard delete (les récurrences seront supprimées en cascade)
    const [deleted] = await db
      .delete(remplacantDisponibilitesPeriodes)
      .where(eq(remplacantDisponibilitesPeriodes.id, parseInt(periodeId)))
      .returning()

    return NextResponse.json({ data: deleted })
  } catch (error) {
    console.error('Error deleting période:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
