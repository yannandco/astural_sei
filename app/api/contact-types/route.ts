import { NextRequest, NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contactTypes } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

// GET - List all contact types
export async function GET() {
  try {
    const types = await db
      .select()
      .from(contactTypes)
      .orderBy(asc(contactTypes.sortOrder), asc(contactTypes.name))

    return NextResponse.json({ data: types })
  } catch (error) {
    console.error('Error fetching contact types:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST - Create new contact type (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const { name, description, color, sortOrder } = body

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Le nom est requis' },
        { status: 400 }
      )
    }

    const [newType] = await db
      .insert(contactTypes)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
        sortOrder: sortOrder || 0,
      })
      .returning()

    return NextResponse.json({ data: newType }, { status: 201 })
  } catch (error) {
    console.error('Error creating contact type:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
