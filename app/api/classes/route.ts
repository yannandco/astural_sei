import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, ilike, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classes, ecoles } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'user'])

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const ecoleId = searchParams.get('ecoleId')

    const conditions = []

    if (search) {
      conditions.push(ilike(classes.name, `%${search}%`))
    }

    if (ecoleId) {
      conditions.push(eq(classes.ecoleId, parseInt(ecoleId)))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const data = await db
      .select({
        id: classes.id,
        name: classes.name,
        ecoleId: classes.ecoleId,
        isActive: classes.isActive,
        createdAt: classes.createdAt,
        ecoleName: ecoles.name,
      })
      .from(classes)
      .leftJoin(ecoles, eq(classes.ecoleId, ecoles.id))
      .where(whereClause)
      .orderBy(asc(classes.name))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching classes:', error)
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
    const { name, ecoleId } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }
    if (!ecoleId) {
      return NextResponse.json({ error: "L'école est requise" }, { status: 400 })
    }

    const [created] = await db
      .insert(classes)
      .values({
        name: name.trim(),
        ecoleId,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating classe:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
