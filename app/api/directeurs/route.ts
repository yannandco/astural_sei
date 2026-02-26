import { NextRequest, NextResponse } from 'next/server'
import { asc, ilike, and, sql, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { directeurs, ecoles, etablissements } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const conditions = []

    if (search) {
      conditions.push(
        sql`(${ilike(directeurs.lastName, `%${search}%`)} OR ${ilike(directeurs.firstName, `%${search}%`)} OR ${ilike(directeurs.email, `%${search}%`)})`
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Récupérer les directeurs
    const directeursData = await db
      .select()
      .from(directeurs)
      .where(whereClause)
      .orderBy(asc(directeurs.lastName), asc(directeurs.firstName))

    // Récupérer les écoles avec leurs établissements pour chaque directeur
    const ecolesData = await db
      .select({
        directeurId: ecoles.directeurId,
        ecoleId: ecoles.id,
        ecoleName: ecoles.name,
        etablissementId: etablissements.id,
        etablissementName: etablissements.name,
      })
      .from(ecoles)
      .leftJoin(etablissements, eq(ecoles.etablissementId, etablissements.id))
      .where(eq(ecoles.isActive, true))

    // Grouper les écoles par directeur
    const ecolesByDirecteur = new Map<number, { ecoleName: string; etablissementName: string | null }[]>()
    for (const e of ecolesData) {
      if (e.directeurId) {
        const list = ecolesByDirecteur.get(e.directeurId) || []
        list.push({ ecoleName: e.ecoleName, etablissementName: e.etablissementName })
        ecolesByDirecteur.set(e.directeurId, list)
      }
    }

    // Enrichir les directeurs avec leurs écoles
    const data = directeursData.map((d) => ({
      ...d,
      ecoles: ecolesByDirecteur.get(d.id) || [],
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching directeurs:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireRole(['admin'])

    const body = await request.json()
    const { lastName, firstName, email, phone } = body

    if (!lastName || !firstName) {
      return NextResponse.json({ error: 'Nom et prénom sont requis' }, { status: 400 })
    }

    const [created] = await db
      .insert(directeurs)
      .values({
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating directeur:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
