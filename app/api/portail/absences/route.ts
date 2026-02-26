import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { absences, remplacantAffectations, remplacants, ecoles } from '@/lib/db/schema'
import { getPortailUser } from '@/lib/auth/server'

type Creneau = 'matin' | 'apres_midi' | 'journee'
type Motif = 'maladie' | 'conge' | 'formation' | 'autre'

// GET - Liste des absences du collaborateur connecté
export async function GET() {
  try {
    const portailUser = await getPortailUser()

    if (portailUser.role !== 'collaborateur') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const collaborateurId = portailUser.collaborateur!.id

    const data = await db
      .select()
      .from(absences)
      .where(and(
        eq(absences.collaborateurId, collaborateurId),
        eq(absences.type, 'collaborateur'),
        eq(absences.isActive, true)
      ))
      .orderBy(desc(absences.dateDebut))

    // Enrich with replacement info
    const enriched = await Promise.all(data.map(async (absence) => {
      const affectations = await db
        .select({
          id: remplacantAffectations.id,
          remplacantNom: remplacants.lastName,
          remplacantPrenom: remplacants.firstName,
          ecoleNom: ecoles.name,
          dateDebut: remplacantAffectations.dateDebut,
          dateFin: remplacantAffectations.dateFin,
          creneau: remplacantAffectations.creneau,
        })
        .from(remplacantAffectations)
        .leftJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
        .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
        .where(and(
          eq(remplacantAffectations.collaborateurId, collaborateurId),
          eq(remplacantAffectations.isActive, true),
        ))

      return {
        ...absence,
        isRemplacee: affectations.length > 0,
        remplacements: affectations,
      }
    }))

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('Error fetching portail absences:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer une absence pour le collaborateur connecté
export async function POST(request: NextRequest) {
  try {
    const portailUser = await getPortailUser()

    if (portailUser.role !== 'collaborateur') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const collaborateurId = portailUser.collaborateur!.id
    const body = await request.json()
    const { dateDebut, dateFin, creneau, motif, motifDetails } = body

    if (!dateDebut || !dateFin || !creneau || !motif) {
      return NextResponse.json({ error: 'Dates, créneau et motif requis' }, { status: 400 })
    }

    const validCreneaux: Creneau[] = ['matin', 'apres_midi', 'journee']
    if (!validCreneaux.includes(creneau as Creneau)) {
      return NextResponse.json({ error: 'Créneau invalide' }, { status: 400 })
    }

    const validMotifs: Motif[] = ['maladie', 'conge', 'formation', 'autre']
    if (!validMotifs.includes(motif as Motif)) {
      return NextResponse.json({ error: 'Motif invalide' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(dateFin)) {
      return NextResponse.json({ error: 'Format de date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    if (dateDebut > dateFin) {
      return NextResponse.json({ error: 'La date de début doit être avant ou égale à la date de fin' }, { status: 400 })
    }

    const [created] = await db
      .insert(absences)
      .values({
        type: 'collaborateur',
        collaborateurId,
        dateDebut,
        dateFin,
        creneau: creneau as Creneau,
        motif: motif as Motif,
        motifDetails: motifDetails || null,
        isActive: true,
        createdBy: portailUser.user.id,
        updatedBy: portailUser.user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating portail absence:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une absence future
export async function DELETE(request: NextRequest) {
  try {
    const portailUser = await getPortailUser()

    if (portailUser.role !== 'collaborateur') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const collaborateurId = portailUser.collaborateur!.id
    const { searchParams } = new URL(request.url)
    const absenceId = searchParams.get('id')

    if (!absenceId) {
      return NextResponse.json({ error: 'ID d\'absence requis' }, { status: 400 })
    }

    // Verify the absence belongs to this collaborateur
    const [existing] = await db
      .select()
      .from(absences)
      .where(and(
        eq(absences.id, parseInt(absenceId)),
        eq(absences.collaborateurId, collaborateurId),
        eq(absences.isActive, true)
      ))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Absence non trouvée' }, { status: 404 })
    }

    // Only allow deleting future absences
    const today = new Date().toISOString().split('T')[0]
    if (existing.dateDebut < today) {
      return NextResponse.json({ error: 'Impossible de supprimer une absence passée' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(absences)
      .where(eq(absences.id, parseInt(absenceId)))
      .returning()

    return NextResponse.json({ data: deleted })
  } catch (error) {
    console.error('Error deleting portail absence:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
