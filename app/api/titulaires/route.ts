import { NextRequest, NextResponse } from 'next/server'
import { asc, ilike, and, sql, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { titulaires, titulaireAffectations, ecoles, etablissements, classes } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'user'])

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const conditions = []

    if (search) {
      conditions.push(
        sql`(${ilike(titulaires.lastName, `%${search}%`)} OR ${ilike(titulaires.firstName, `%${search}%`)} OR ${ilike(titulaires.email, `%${search}%`)})`
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Récupérer les titulaires
    const titulairesData = await db
      .select()
      .from(titulaires)
      .where(whereClause)
      .orderBy(asc(titulaires.lastName), asc(titulaires.firstName))

    // Récupérer les affectations avec écoles et établissements
    const affectationsData = await db
      .select({
        titulaireId: titulaireAffectations.titulaireId,
        ecoleId: ecoles.id,
        ecoleName: ecoles.name,
        etablissementId: etablissements.id,
        etablissementName: etablissements.name,
        classeName: classes.name,
      })
      .from(titulaireAffectations)
      .leftJoin(ecoles, eq(titulaireAffectations.ecoleId, ecoles.id))
      .leftJoin(etablissements, eq(ecoles.etablissementId, etablissements.id))
      .leftJoin(classes, eq(titulaireAffectations.classeId, classes.id))
      .where(eq(titulaireAffectations.isActive, true))

    // Grouper les affectations par titulaire
    const affectationsByTitulaire = new Map<number, { ecoleName: string | null; etablissementName: string | null; classeName: string | null }[]>()
    for (const a of affectationsData) {
      const list = affectationsByTitulaire.get(a.titulaireId) || []
      list.push({ ecoleName: a.ecoleName, etablissementName: a.etablissementName, classeName: a.classeName })
      affectationsByTitulaire.set(a.titulaireId, list)
    }

    // Enrichir les titulaires avec leurs affectations
    const data = titulairesData.map((t) => ({
      ...t,
      affectations: affectationsByTitulaire.get(t.id) || [],
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching titulaires:', error)
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
      .insert(titulaires)
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
    console.error('Error creating titulaire:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
