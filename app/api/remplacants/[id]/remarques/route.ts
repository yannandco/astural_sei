import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { remplacantRemarques, users } from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const data = await db
      .select({
        id: remplacantRemarques.id,
        content: remplacantRemarques.content,
        createdAt: remplacantRemarques.createdAt,
        createdById: remplacantRemarques.createdBy,
        createdByName: users.name,
        createdByEmail: users.email,
      })
      .from(remplacantRemarques)
      .leftJoin(users, eq(remplacantRemarques.createdBy, users.id))
      .where(eq(remplacantRemarques.remplacantId, remplacantId))
      .orderBy(desc(remplacantRemarques.createdAt))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching remarques:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()

    const { id } = await params
    const remplacantId = parseInt(id)

    if (isNaN(remplacantId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { content } = body

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Le contenu est requis' }, { status: 400 })
    }

    const [created] = await db
      .insert(remplacantRemarques)
      .values({
        remplacantId,
        content: content.trim(),
        createdBy: user.id,
      })
      .returning()

    // Fetch with user info
    const [remarque] = await db
      .select({
        id: remplacantRemarques.id,
        content: remplacantRemarques.content,
        createdAt: remplacantRemarques.createdAt,
        createdById: remplacantRemarques.createdBy,
        createdByName: users.name,
        createdByEmail: users.email,
      })
      .from(remplacantRemarques)
      .leftJoin(users, eq(remplacantRemarques.createdBy, users.id))
      .where(eq(remplacantRemarques.id, created.id))

    return NextResponse.json({ data: remarque }, { status: 201 })
  } catch (error) {
    console.error('Error creating remarque:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
