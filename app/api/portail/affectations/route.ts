import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantAffectations, collaborateurs, ecoles, directeurs } from '@/lib/db/schema'
import { getPortailUser } from '@/lib/auth/server'

// GET - Liste des affectations du remplaçant connecté (lecture seule)
export async function GET(request: NextRequest) {
  try {
    const portailUser = await getPortailUser()

    if (portailUser.role !== 'remplacant') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const remplacantId = portailUser.remplacant!.id
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'

    const today = new Date().toISOString().split('T')[0]
    const conditions = [
      eq(remplacantAffectations.remplacantId, remplacantId),
      eq(remplacantAffectations.isActive, true),
    ]

    if (period === 'future') {
      conditions.push(gte(remplacantAffectations.dateFin, today))
    } else if (period === 'past') {
      conditions.push(lte(remplacantAffectations.dateFin, today))
    }

    const data = await db
      .select({
        id: remplacantAffectations.id,
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
    console.error('Error fetching portail affectations:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
