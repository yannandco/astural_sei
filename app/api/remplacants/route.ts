import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, ilike, and, sql, lte, gte, notInArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacants, remplacantAffectations } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const isAvailable = searchParams.get('isAvailable')
    const availableFrom = searchParams.get('availableFrom')
    const availableTo = searchParams.get('availableTo')

    const conditions = []

    if (search) {
      conditions.push(
        sql`(${ilike(remplacants.lastName, `%${search}%`)} OR ${ilike(remplacants.firstName, `%${search}%`)} OR ${ilike(remplacants.email, `%${search}%`)})`
      )
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      conditions.push(eq(remplacants.isActive, isActive === 'true'))
    }

    if (isAvailable !== null && isAvailable !== undefined && isAvailable !== '') {
      conditions.push(eq(remplacants.isAvailable, isAvailable === 'true'))
    }

    // Exclude remplaçants who already have a conflicting affectation
    if (availableFrom && availableTo) {
      const busyRemplacants = await db
        .select({ remplacantId: remplacantAffectations.remplacantId })
        .from(remplacantAffectations)
        .where(
          and(
            eq(remplacantAffectations.isActive, true),
            lte(remplacantAffectations.dateDebut, availableTo),
            gte(remplacantAffectations.dateFin, availableFrom)
          )
        )

      const busyIds = [...new Set(busyRemplacants.map((r) => r.remplacantId))]
      if (busyIds.length > 0) {
        conditions.push(notInArray(remplacants.id, busyIds))
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const data = await db
      .select()
      .from(remplacants)
      .where(whereClause)
      .orderBy(asc(remplacants.lastName), asc(remplacants.firstName))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching remplacants:', error)
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
    const { lastName, firstName, address, phone, email, isAvailable, availabilityNote, contractStartDate, contractEndDate } = body

    if (!lastName || lastName.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }
    if (!firstName || firstName.trim() === '') {
      return NextResponse.json({ error: 'Le prénom est requis' }, { status: 400 })
    }

    const [created] = await db
      .insert(remplacants)
      .values({
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        isAvailable: isAvailable ?? true,
        availabilityNote: availabilityNote?.trim() || null,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating remplacant:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
