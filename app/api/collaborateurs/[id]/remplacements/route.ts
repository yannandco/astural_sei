import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { absences, collaborateurs, remplacantAffectations, remplacants, ecoles, directeurs } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Liste des remplacements pour un collaborateur
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
      eq(remplacantAffectations.collaborateurId, collaborateurId),
      eq(remplacantAffectations.isActive, true),
    ]

    if (startDate && endDate) {
      conditions.push(lte(remplacantAffectations.dateDebut, endDate))
      conditions.push(gte(remplacantAffectations.dateFin, startDate))
    }

    const data = await db
      .select({
        id: remplacantAffectations.id,
        remplacantId: remplacantAffectations.remplacantId,
        remplacantNom: remplacants.lastName,
        remplacantPrenom: remplacants.firstName,
        ecoleId: remplacantAffectations.ecoleId,
        ecoleNom: ecoles.name,
        directeurNom: directeurs.lastName,
        directeurPrenom: directeurs.firstName,
        directeurEmail: directeurs.email,
        directeurPhone: directeurs.phone,
        titulairesNoms: sql<string>`(
          SELECT string_agg(UPPER(t.last_name) || ' ' || t.first_name, ', ' ORDER BY t.last_name)
          FROM titulaire_affectations ta
          JOIN titulaires t ON ta.titulaire_id = t.id
          WHERE ta.ecole_id = ${ecoles.id} AND ta.is_active = true
        )`.as('titulaires_noms'),
        titulairesEmails: sql<string>`(
          SELECT string_agg(t.email, ', ' ORDER BY t.last_name)
          FROM titulaire_affectations ta
          JOIN titulaires t ON ta.titulaire_id = t.id
          WHERE ta.ecole_id = ${ecoles.id} AND ta.is_active = true AND t.email IS NOT NULL
        )`.as('titulaires_emails'),
        titulairesPhones: sql<string>`(
          SELECT string_agg(t.phone, ', ' ORDER BY t.last_name)
          FROM titulaire_affectations ta
          JOIN titulaires t ON ta.titulaire_id = t.id
          WHERE ta.ecole_id = ${ecoles.id} AND ta.is_active = true AND t.phone IS NOT NULL
        )`.as('titulaires_phones'),
        dateDebut: remplacantAffectations.dateDebut,
        dateFin: remplacantAffectations.dateFin,
        creneau: remplacantAffectations.creneau,
        motif: remplacantAffectations.motif,
        createdAt: remplacantAffectations.createdAt,
      })
      .from(remplacantAffectations)
      .leftJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
      .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
      .leftJoin(directeurs, eq(ecoles.directeurId, directeurs.id))
      .where(and(...conditions))
      .orderBy(desc(remplacantAffectations.dateDebut))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching remplacements:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Annoncer un remplacement (crée UNE absence + N affectations par créneau détecté)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { remplacantId, dateDebut, dateFin, entries, motif, motifDetails, skipAbsenceCreation } = body as {
      remplacantId: number
      dateDebut: string
      dateFin: string
      entries: { ecoleId: number; date: string; creneau: 'matin' | 'apres_midi' | 'journee' }[]
      motif: 'maladie' | 'conge' | 'formation' | 'autre'
      motifDetails?: string
      skipAbsenceCreation?: boolean
    }

    if (!remplacantId || !dateDebut || !dateFin || !entries || !Array.isArray(entries) || entries.length === 0 || (!motif && !skipAbsenceCreation)) {
      return NextResponse.json({ error: 'Tous les champs obligatoires doivent être renseignés' }, { status: 400 })
    }

    const validCreneaux = ['matin', 'apres_midi', 'journee']
    const validMotifs = ['maladie', 'conge', 'formation', 'autre']

    if (!skipAbsenceCreation && !validMotifs.includes(motif)) {
      return NextResponse.json({ error: 'Motif invalide' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(dateFin)) {
      return NextResponse.json({ error: 'Format de date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    for (const entry of entries) {
      if (!entry.ecoleId || !entry.date || !entry.creneau) {
        return NextResponse.json({ error: 'Chaque entrée doit avoir ecoleId, date et creneau' }, { status: 400 })
      }
      if (!validCreneaux.includes(entry.creneau)) {
        return NextResponse.json({ error: 'Créneau invalide' }, { status: 400 })
      }
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

    // Vérifier que le remplaçant existe
    const [remp] = await db
      .select({ id: remplacants.id })
      .from(remplacants)
      .where(eq(remplacants.id, remplacantId))
      .limit(1)

    if (!remp) {
      return NextResponse.json({ error: 'Remplaçant non trouvé' }, { status: 404 })
    }

    // 1. Créer UNE SEULE absence pour toute la période (sauf si les absences existent déjà)
    let createdAbsence = null
    if (!skipAbsenceCreation) {
      // Vérifier si une absence existe déjà pour ce collaborateur sur cette période
      const existingAbsence = await db
        .select({ id: absences.id })
        .from(absences)
        .where(and(
          eq(absences.collaborateurId, collaborateurId),
          eq(absences.isActive, true),
          lte(absences.dateDebut, dateFin),
          gte(absences.dateFin, dateDebut),
        ))
        .limit(1)

      if (existingAbsence.length === 0) {
        const [abs] = await db
          .insert(absences)
          .values({
            type: 'collaborateur',
            collaborateurId,
            dateDebut,
            dateFin,
            creneau: 'journee',
            motif,
            motifDetails: motifDetails || null,
            isActive: true,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning()
        createdAbsence = abs
      }
    }

    // 2. Créer une affectation par entrée (une par date/créneau spécifique)
    const createdAffectations = []

    for (const entry of entries) {
      const [createdAffectation] = await db
        .insert(remplacantAffectations)
        .values({
          remplacantId,
          collaborateurId,
          ecoleId: entry.ecoleId,
          dateDebut: entry.date,
          dateFin: entry.date,
          creneau: entry.creneau,
          motif: motif || 'autre',
          isActive: true,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning()

      createdAffectations.push(createdAffectation)
    }

    return NextResponse.json({
      data: {
        absence: createdAbsence,
        affectations: createdAffectations,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating remplacement:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH - Changer le remplaçant sur une affectation existante
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { affectationId, remplacantId } = body

    if (!affectationId || !remplacantId) {
      return NextResponse.json({ error: 'ID d\'affectation et ID remplaçant requis' }, { status: 400 })
    }

    // Vérifier que l'affectation existe et concerne le collaborateur
    const [existing] = await db
      .select()
      .from(remplacantAffectations)
      .where(
        and(
          eq(remplacantAffectations.id, affectationId),
          eq(remplacantAffectations.collaborateurId, collaborateurId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Affectation non trouvée' }, { status: 404 })
    }

    // Vérifier que le nouveau remplaçant existe
    const [remp] = await db
      .select({ id: remplacants.id })
      .from(remplacants)
      .where(eq(remplacants.id, remplacantId))
      .limit(1)

    if (!remp) {
      return NextResponse.json({ error: 'Remplaçant non trouvé' }, { status: 404 })
    }

    // Mettre à jour le remplaçant
    await db
      .update(remplacantAffectations)
      .set({
        remplacantId,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(remplacantAffectations.id, affectationId))

    // Retourner l'affectation mise à jour avec joins
    const [updated] = await db
      .select({
        id: remplacantAffectations.id,
        remplacantId: remplacantAffectations.remplacantId,
        remplacantNom: remplacants.lastName,
        remplacantPrenom: remplacants.firstName,
        ecoleId: remplacantAffectations.ecoleId,
        ecoleNom: ecoles.name,
        dateDebut: remplacantAffectations.dateDebut,
        dateFin: remplacantAffectations.dateFin,
        creneau: remplacantAffectations.creneau,
        motif: remplacantAffectations.motif,
      })
      .from(remplacantAffectations)
      .leftJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
      .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
      .where(eq(remplacantAffectations.id, affectationId))

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating remplacement:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer un remplacement (affectation seulement, l'absence reste)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const affectationId = searchParams.get('affectationId')

    if (!affectationId) {
      return NextResponse.json({ error: 'ID d\'affectation requis' }, { status: 400 })
    }

    // Vérifier que l'affectation existe et concerne le collaborateur
    const [existing] = await db
      .select()
      .from(remplacantAffectations)
      .where(
        and(
          eq(remplacantAffectations.id, parseInt(affectationId)),
          eq(remplacantAffectations.collaborateurId, collaborateurId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Affectation non trouvée' }, { status: 404 })
    }

    // Supprimer l'affectation (l'absence reste)
    const [deleted] = await db
      .delete(remplacantAffectations)
      .where(eq(remplacantAffectations.id, parseInt(affectationId)))
      .returning()

    return NextResponse.json({ data: deleted })
  } catch (error) {
    console.error('Error deleting remplacement:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
