import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, ilike, and, sql, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { etablissements, ecoles, directeurs } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'user'])

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')

    const conditions = []

    if (search) {
      conditions.push(
        sql`(${ilike(etablissements.name, `%${search}%`)} OR ${ilike(etablissements.city, `%${search}%`)})`
      )
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      conditions.push(eq(etablissements.isActive, isActive === 'true'))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const data = await db
      .select({
        id: etablissements.id,
        name: etablissements.name,
        address: etablissements.address,
        postalCode: etablissements.postalCode,
        city: etablissements.city,
        phone: etablissements.phone,
        email: etablissements.email,
        directeurId: etablissements.directeurId,
        directeurLastName: directeurs.lastName,
        directeurFirstName: directeurs.firstName,
        isActive: etablissements.isActive,
        createdAt: etablissements.createdAt,
        updatedAt: etablissements.updatedAt,
        ecolesCount: count(ecoles.id),
      })
      .from(etablissements)
      .leftJoin(directeurs, eq(etablissements.directeurId, directeurs.id))
      .leftJoin(ecoles, eq(etablissements.id, ecoles.etablissementId))
      .where(whereClause)
      .groupBy(etablissements.id, directeurs.lastName, directeurs.firstName)
      .orderBy(asc(etablissements.name))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching etablissements:', error)
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
    const { name, address, postalCode, city, phone, email, directeurId } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    const [created] = await db
      .insert(etablissements)
      .values({
        name: name.trim(),
        address: address?.trim() || null,
        postalCode: postalCode?.trim() || null,
        city: city?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        directeurId: directeurId || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating etablissement:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
