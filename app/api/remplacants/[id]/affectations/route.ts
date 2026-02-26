import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantAffectations, collaborateurs, ecoles, directeurs } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Liste des affectations du remplaçant
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
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    let conditions = [eq(remplacantAffectations.remplacantId, remplacantId)]

    if (activeOnly) {
      conditions.push(eq(remplacantAffectations.isActive, true))
    }

    if (startDate && endDate) {
      // Affectations qui chevauchent la période
      conditions.push(lte(remplacantAffectations.dateDebut, endDate))
      conditions.push(gte(remplacantAffectations.dateFin, startDate))
    }

    const data = await db
      .select({
        id: remplacantAffectations.id,
        remplacantId: remplacantAffectations.remplacantId,
        collaborateurId: remplacantAffectations.collaborateurId,
        collaborateurNom: collaborateurs.lastName,
        collaborateurPrenom: collaborateurs.firstName,
        collaborateurEmail: collaborateurs.email,
        collaborateurMobilePro: collaborateurs.mobilePro,
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
        isActive: remplacantAffectations.isActive,
        createdAt: remplacantAffectations.createdAt,
      })
      .from(remplacantAffectations)
      .leftJoin(collaborateurs, eq(remplacantAffectations.collaborateurId, collaborateurs.id))
      .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
      .leftJoin(directeurs, eq(ecoles.directeurId, directeurs.id))
      .where(and(...conditions))
      .orderBy(desc(remplacantAffectations.dateDebut))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching affectations:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer une affectation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { collaborateurId, ecoleId, dateDebut, dateFin, creneau, motif } = body

    if (!collaborateurId || !ecoleId || !dateDebut || !dateFin || !creneau) {
      return NextResponse.json({
        error: 'Collaborateur, école, dates et créneau requis'
      }, { status: 400 })
    }

    const validCreneaux = ['matin', 'apres_midi', 'journee']
    if (!validCreneaux.includes(creneau)) {
      return NextResponse.json({ error: 'Créneau invalide' }, { status: 400 })
    }

    // Vérifier format dates
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(dateFin)) {
      return NextResponse.json({ error: 'Format de date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    // Vérifier que dateDebut <= dateFin
    if (dateDebut > dateFin) {
      return NextResponse.json({ error: 'La date de début doit être avant ou égale à la date de fin' }, { status: 400 })
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

    // Vérifier que l'école existe
    const [ecole] = await db
      .select({ id: ecoles.id })
      .from(ecoles)
      .where(eq(ecoles.id, ecoleId))
      .limit(1)

    if (!ecole) {
      return NextResponse.json({ error: 'École non trouvée' }, { status: 404 })
    }

    const [created] = await db
      .insert(remplacantAffectations)
      .values({
        remplacantId,
        collaborateurId,
        ecoleId,
        dateDebut,
        dateFin,
        creneau,
        motif: motif || null,
        isActive: true,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    // Récupérer avec les infos jointes
    const [affectation] = await db
      .select({
        id: remplacantAffectations.id,
        remplacantId: remplacantAffectations.remplacantId,
        collaborateurId: remplacantAffectations.collaborateurId,
        collaborateurNom: collaborateurs.lastName,
        collaborateurPrenom: collaborateurs.firstName,
        ecoleId: remplacantAffectations.ecoleId,
        ecoleNom: ecoles.name,
        dateDebut: remplacantAffectations.dateDebut,
        dateFin: remplacantAffectations.dateFin,
        creneau: remplacantAffectations.creneau,
        motif: remplacantAffectations.motif,
        isActive: remplacantAffectations.isActive,
        createdAt: remplacantAffectations.createdAt,
      })
      .from(remplacantAffectations)
      .leftJoin(collaborateurs, eq(remplacantAffectations.collaborateurId, collaborateurs.id))
      .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
      .where(eq(remplacantAffectations.id, created.id))

    return NextResponse.json({ data: affectation }, { status: 201 })
  } catch (error) {
    console.error('Error creating affectation:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH - Modifier une affectation
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { affectationId, collaborateurId, ecoleId, dateDebut, dateFin, creneau, motif, isActive } = body

    if (!affectationId) {
      return NextResponse.json({ error: 'ID d\'affectation requis' }, { status: 400 })
    }

    // Vérifier que l'affectation existe et appartient au remplaçant
    const [existing] = await db
      .select()
      .from(remplacantAffectations)
      .where(
        and(
          eq(remplacantAffectations.id, affectationId),
          eq(remplacantAffectations.remplacantId, remplacantId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Affectation non trouvée' }, { status: 404 })
    }

    // Construire les champs à mettre à jour
    const updates: Record<string, unknown> = {
      updatedBy: user.id,
      updatedAt: new Date(),
    }

    if (collaborateurId !== undefined) updates.collaborateurId = collaborateurId
    if (ecoleId !== undefined) updates.ecoleId = ecoleId
    if (dateDebut !== undefined) updates.dateDebut = dateDebut
    if (dateFin !== undefined) updates.dateFin = dateFin
    if (creneau !== undefined) updates.creneau = creneau
    if (motif !== undefined) updates.motif = motif
    if (isActive !== undefined) updates.isActive = isActive

    const [updated] = await db
      .update(remplacantAffectations)
      .set(updates)
      .where(eq(remplacantAffectations.id, affectationId))
      .returning()

    // Récupérer avec les infos jointes
    const [affectation] = await db
      .select({
        id: remplacantAffectations.id,
        remplacantId: remplacantAffectations.remplacantId,
        collaborateurId: remplacantAffectations.collaborateurId,
        collaborateurNom: collaborateurs.lastName,
        collaborateurPrenom: collaborateurs.firstName,
        ecoleId: remplacantAffectations.ecoleId,
        ecoleNom: ecoles.name,
        dateDebut: remplacantAffectations.dateDebut,
        dateFin: remplacantAffectations.dateFin,
        creneau: remplacantAffectations.creneau,
        motif: remplacantAffectations.motif,
        isActive: remplacantAffectations.isActive,
        createdAt: remplacantAffectations.createdAt,
      })
      .from(remplacantAffectations)
      .leftJoin(collaborateurs, eq(remplacantAffectations.collaborateurId, collaborateurs.id))
      .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
      .where(eq(remplacantAffectations.id, updated.id))

    return NextResponse.json({ data: affectation })
  } catch (error) {
    console.error('Error updating affectation:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une affectation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const affectationId = searchParams.get('affectationId')

    if (!affectationId) {
      return NextResponse.json({ error: 'ID d\'affectation requis' }, { status: 400 })
    }

    // Vérifier que l'affectation existe et appartient au remplaçant
    const [existing] = await db
      .select()
      .from(remplacantAffectations)
      .where(
        and(
          eq(remplacantAffectations.id, parseInt(affectationId)),
          eq(remplacantAffectations.remplacantId, remplacantId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Affectation non trouvée' }, { status: 404 })
    }

    // Hard delete
    const [deleted] = await db
      .delete(remplacantAffectations)
      .where(eq(remplacantAffectations.id, parseInt(affectationId)))
      .returning()

    return NextResponse.json({ data: deleted })
  } catch (error) {
    console.error('Error deleting affectation:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
