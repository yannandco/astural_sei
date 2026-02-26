import { NextRequest, NextResponse } from 'next/server'
import { eq, and, or, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { absences, collaborateurs, remplacantAffectations, remplacants, collaborateurEcoles, ecoles } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'
import { computeEcoleUrgency, computeOverallUrgency, type EcoleUrgency } from '@/lib/urgency'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Liste des absences du collaborateur
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const conditions = [
      eq(absences.type, 'collaborateur'),
      eq(absences.collaborateurId, collaborateurId),
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
        collaborateurId: absences.collaborateurId,
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

    const today = new Date().toISOString().split('T')[0]

    // Get collaborateur's écoles for urgency computation
    const collabEcoles = await db
      .select({
        ecoleId: collaborateurEcoles.ecoleId,
        remplacementApresJours: ecoles.remplacementApresJours,
        ecoleName: ecoles.name,
      })
      .from(collaborateurEcoles)
      .leftJoin(ecoles, eq(collaborateurEcoles.ecoleId, ecoles.id))
      .where(eq(collaborateurEcoles.collaborateurId, collaborateurId))

    // Pour chaque absence, vérifier si elle est couverte par un remplacement
    const enrichedData = await Promise.all(
      data.map(async (absence) => {
        // Créneau matching: le remplacement doit couvrir le même créneau que l'absence
        const creneauCondition = absence.creneau === 'journee'
          ? undefined // journée = tout créneau de remplacement couvre
          : or(
              eq(remplacantAffectations.creneau, absence.creneau),
              eq(remplacantAffectations.creneau, 'journee')
            )

        const remplacementConditions = [
          eq(remplacantAffectations.collaborateurId, collaborateurId),
          eq(remplacantAffectations.isActive, true),
          lte(remplacantAffectations.dateDebut, absence.dateFin),
          gte(remplacantAffectations.dateFin, absence.dateDebut),
        ]
        if (creneauCondition) remplacementConditions.push(creneauCondition)

        const remplacement = await db
          .select({
            id: remplacantAffectations.id,
            remplacantId: remplacantAffectations.remplacantId,
            remplacantNom: remplacants.lastName,
            remplacantPrenom: remplacants.firstName,
          })
          .from(remplacantAffectations)
          .leftJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
          .where(and(...remplacementConditions))
          .limit(1)

        const isRemplacee = remplacement.length > 0

        // Compute urgency per école
        const ecoleUrgencies: EcoleUrgency[] = collabEcoles.map(e => {
          const { urgency, joursRestants } = computeEcoleUrgency(
            absence.dateDebut,
            e.remplacementApresJours,
            isRemplacee,
            today,
          )
          return {
            ecoleId: e.ecoleId,
            ecoleName: e.ecoleName || '',
            remplacementApresJours: e.remplacementApresJours,
            isRemplacee,
            urgency,
            joursRestants,
          }
        })

        const overall = computeOverallUrgency(ecoleUrgencies)

        return {
          ...absence,
          isRemplacee,
          remplacement: remplacement[0] || null,
          urgency: overall.urgency,
          joursRestants: overall.joursRestants,
        }
      })
    )

    return NextResponse.json({ data: enrichedData })
  } catch (error) {
    console.error('Error fetching absences:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer une absence collaborateur
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

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

    // Vérifier que le collaborateur existe
    const [collab] = await db
      .select({ id: collaborateurs.id })
      .from(collaborateurs)
      .where(eq(collaborateurs.id, collaborateurId))
      .limit(1)

    if (!collab) {
      return NextResponse.json({ error: 'Collaborateur non trouvé' }, { status: 404 })
    }

    const [created] = await db
      .insert(absences)
      .values({
        type: 'collaborateur',
        collaborateurId,
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
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
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
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { absenceId, dateDebut, dateFin, creneau, motif, motifDetails } = body

    if (!absenceId) {
      return NextResponse.json({ error: 'ID d\'absence requis' }, { status: 400 })
    }

    // Vérifier que l'absence existe et appartient au collaborateur
    const [existing] = await db
      .select()
      .from(absences)
      .where(
        and(
          eq(absences.id, absenceId),
          eq(absences.type, 'collaborateur'),
          eq(absences.collaborateurId, collaborateurId)
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
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
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
    await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

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
          eq(absences.type, 'collaborateur'),
          eq(absences.collaborateurId, collaborateurId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Absence non trouvée' }, { status: 404 })
    }

    // Supprimer les affectations de remplacement qui chevauchent cette absence
    await db
      .delete(remplacantAffectations)
      .where(
        and(
          eq(remplacantAffectations.collaborateurId, collaborateurId),
          lte(remplacantAffectations.dateDebut, existing.dateFin),
          gte(remplacantAffectations.dateFin, existing.dateDebut)
        )
      )

    const [deleted] = await db
      .delete(absences)
      .where(eq(absences.id, parseInt(absenceId)))
      .returning()

    return NextResponse.json({ data: deleted })
  } catch (error) {
    console.error('Error deleting absence:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
