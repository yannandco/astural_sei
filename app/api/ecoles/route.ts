import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, ilike, and, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { ecoles, etablissements, directeurs, titulaireAffectations, titulaires, collaborateurEcoles } from '@/lib/db/schema'
import { collaborateurs } from '@/lib/db/schema/collaborateurs'
import { requireRole, requireAuth } from '@/lib/auth/server'

const ecoleDirecteurs = alias(directeurs, 'ecole_directeurs')
const etabDirecteurs = alias(directeurs, 'etab_directeurs')

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const etablissementId = searchParams.get('etablissementId')
    const isActive = searchParams.get('isActive')
    const available = searchParams.get('available')

    const conditions = []

    if (search) {
      conditions.push(ilike(ecoles.name, `%${search}%`))
    }

    if (etablissementId && available !== 'true') {
      conditions.push(eq(ecoles.etablissementId, parseInt(etablissementId)))
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      conditions.push(eq(ecoles.isActive, isActive === 'true'))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const data = await db
      .select({
        id: ecoles.id,
        name: ecoles.name,
        etablissementId: ecoles.etablissementId,
        directeurId: ecoles.directeurId,
        rue: ecoles.rue,
        codePostal: ecoles.codePostal,
        ville: ecoles.ville,
        phone: ecoles.phone,
        email: ecoles.email,
        isActive: ecoles.isActive,
        createdAt: ecoles.createdAt,
        updatedAt: ecoles.updatedAt,
        etablissementName: etablissements.name,
        etablissementDirecteurId: etablissements.directeurId,
        // Directeur propre à l'école (override)
        directeurLastName: ecoleDirecteurs.lastName,
        directeurFirstName: ecoleDirecteurs.firstName,
        // Directeur de l'établissement (hérité)
        etabDirecteurLastName: etabDirecteurs.lastName,
        etabDirecteurFirstName: etabDirecteurs.firstName,
        // Titulaires (agrégés) - NOM Prénom
        titulairesNoms: sql<string>`(
          SELECT string_agg(UPPER(t.last_name) || ' ' || t.first_name, ', ' ORDER BY t.last_name)
          FROM titulaire_affectations ta
          JOIN titulaires t ON ta.titulaire_id = t.id
          WHERE ta.ecole_id = ${ecoles.id} AND ta.is_active = true
        )`.as('titulaires_noms'),
        // Collaborateurs (agrégés) - NOM Prénom
        collaborateursNoms: sql<string>`(
          SELECT string_agg(UPPER(c.last_name) || ' ' || c.first_name, ', ' ORDER BY c.last_name)
          FROM collaborateur_ecoles ce
          JOIN collaborateurs c ON ce.collaborateur_id = c.id
          WHERE ce.ecole_id = ${ecoles.id} AND ce.is_active = true
        )`.as('collaborateurs_noms'),
      })
      .from(ecoles)
      .leftJoin(etablissements, eq(ecoles.etablissementId, etablissements.id))
      .leftJoin(ecoleDirecteurs, eq(ecoles.directeurId, ecoleDirecteurs.id))
      .leftJoin(etabDirecteurs, eq(etablissements.directeurId, etabDirecteurs.id))
      .where(whereClause)
      .orderBy(asc(ecoles.name))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching ecoles:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireRole(['admin'])

    const body = await request.json()
    const { name, etablissementId, directeurId, rue, codePostal, ville, phone, email } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }
    if (!etablissementId) {
      return NextResponse.json({ error: "L'établissement est requis" }, { status: 400 })
    }

    const [created] = await db
      .insert(ecoles)
      .values({
        name: name.trim(),
        etablissementId,
        directeurId: directeurId || null,
        rue: rue?.trim() || null,
        codePostal: codePostal?.trim() || null,
        ville: ville?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating ecole:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
