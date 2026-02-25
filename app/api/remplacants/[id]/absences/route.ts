import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { absences, remplacants, remplacantAffectations, collaborateurs, ecoles } from '@/lib/db/schema'
import { requireAuth, requireAdminOrSelfRemplacant } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Liste des absences du remplaçant
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

    const conditions = [
      eq(absences.type, 'remplacant'),
      eq(absences.remplacantId, remplacantId),
      eq(absences.isActive, true),
    ]

    if (startDate && endDate) {
      conditions.push(lte(absences.dateDebut, endDate))
      conditions.push(gte(absences.dateFin, startDate))
    }

    const data = await db
      .select({
        id: absences.id,
        type: absences.type,
        remplacantId: absences.remplacantId,
        dateDebut: absences.dateDebut,
        dateFin: absences.dateFin,
        creneau: absences.creneau,
        motif: absences.motif,
        motifDetails: absences.motifDetails,
        isActive: absences.isActive,
        createdAt: absences.createdAt,
      })
      .from(absences)
      .where(and(...conditions))
      .orderBy(desc(absences.dateDebut))

    // Pour chaque absence, trouver les affectations impactées
    const enrichedData = await Promise.all(
      data.map(async (absence) => {
        const affectationsImpactees = await db
          .select({
            id: remplacantAffectations.id,
            collaborateurId: remplacantAffectations.collaborateurId,
            collaborateurNom: collaborateurs.lastName,
            collaborateurPrenom: collaborateurs.firstName,
            ecoleId: remplacantAffectations.ecoleId,
            ecoleNom: ecoles.name,
            dateDebut: remplacantAffectations.dateDebut,
            dateFin: remplacantAffectations.dateFin,
            creneau: remplacantAffectations.creneau,
          })
          .from(remplacantAffectations)
          .leftJoin(collaborateurs, eq(remplacantAffectations.collaborateurId, collaborateurs.id))
          .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
          .where(
            and(
              eq(remplacantAffectations.remplacantId, remplacantId),
              eq(remplacantAffectations.isActive, true),
              lte(remplacantAffectations.dateDebut, absence.dateFin),
              gte(remplacantAffectations.dateFin, absence.dateDebut)
            )
          )

        return {
          ...absence,
          affectationsImpactees,
        }
      })
    )

    return NextResponse.json({ data: enrichedData })
  } catch (error) {
    console.error('Error fetching absences:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer une absence remplaçant
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { user } = await requireAdminOrSelfRemplacant(remplacantId)

    const body = await request.json()
    const { dateDebut, dateFin, creneau, motif, motifDetails } = body

    if (!dateDebut || !dateFin || !creneau || !motif) {
      return NextResponse.json({ error: 'Dates, créneau et motif requis' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(dateFin)) {
      return NextResponse.json({ error: 'Format de date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    if (dateDebut > dateFin) {
      return NextResponse.json({ error: 'La date de début doit être avant ou égale à la date de fin' }, { status: 400 })
    }

    const validCreneaux = ['matin', 'apres_midi', 'journee']
    if (!validCreneaux.includes(creneau)) {
      return NextResponse.json({ error: 'Créneau invalide' }, { status: 400 })
    }

    const validMotifs = ['maladie', 'conge', 'formation', 'autre']
    if (!validMotifs.includes(motif)) {
      return NextResponse.json({ error: 'Motif invalide' }, { status: 400 })
    }

    // Vérifier que le remplaçant existe
    const [rempl] = await db
      .select({ id: remplacants.id })
      .from(remplacants)
      .where(eq(remplacants.id, remplacantId))
      .limit(1)

    if (!rempl) {
      return NextResponse.json({ error: 'Remplaçant non trouvé' }, { status: 404 })
    }

    const [created] = await db
      .insert(absences)
      .values({
        type: 'remplacant',
        remplacantId,
        dateDebut,
        dateFin,
        creneau,
        motif,
        motifDetails: motifDetails || null,
        isActive: true,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating absence:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH - Modifier une absence
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { user } = await requireAdminOrSelfRemplacant(remplacantId)

    const body = await request.json()
    const { absenceId, dateDebut, dateFin, creneau, motif, motifDetails } = body

    if (!absenceId) {
      return NextResponse.json({ error: 'ID d\'absence requis' }, { status: 400 })
    }

    const [existing] = await db
      .select()
      .from(absences)
      .where(
        and(
          eq(absences.id, absenceId),
          eq(absences.type, 'remplacant'),
          eq(absences.remplacantId, remplacantId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Absence non trouvée' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {
      updatedBy: user.id,
      updatedAt: new Date(),
    }

    if (dateDebut !== undefined) updates.dateDebut = dateDebut
    if (dateFin !== undefined) updates.dateFin = dateFin
    if (creneau !== undefined) updates.creneau = creneau
    if (motif !== undefined) updates.motif = motif
    if (motifDetails !== undefined) updates.motifDetails = motifDetails

    const [updated] = await db
      .update(absences)
      .set(updates)
      .where(eq(absences.id, absenceId))
      .returning()

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating absence:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une absence
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    await requireAdminOrSelfRemplacant(remplacantId)

    const { searchParams } = new URL(request.url)
    const absenceId = searchParams.get('absenceId')

    if (!absenceId) {
      return NextResponse.json({ error: 'ID d\'absence requis' }, { status: 400 })
    }

    const [existing] = await db
      .select()
      .from(absences)
      .where(
        and(
          eq(absences.id, parseInt(absenceId)),
          eq(absences.type, 'remplacant'),
          eq(absences.remplacantId, remplacantId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Absence non trouvée' }, { status: 404 })
    }

    const [deleted] = await db
      .delete(absences)
      .where(eq(absences.id, parseInt(absenceId)))
      .returning()

    return NextResponse.json({ data: deleted })
  } catch (error) {
    console.error('Error deleting absence:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
