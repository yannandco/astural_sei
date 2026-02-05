import { NextRequest, NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sectors } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

export async function GET() {
  try {
    const data = await db
      .select()
      .from(sectors)
      .orderBy(asc(sectors.sortOrder), asc(sectors.name))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching sectors:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const { name, description, color, sortOrder } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    const [newSector] = await db
      .insert(sectors)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
        sortOrder: sortOrder || 0,
      })
      .returning()

    return NextResponse.json({ data: newSector }, { status: 201 })
  } catch (error) {
    console.error('Error creating sector:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
