import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { periodesScolaires } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAuth()

    const data = await db
      .select()
      .from(periodesScolaires)
      .orderBy(periodesScolaires.code)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching périodes:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const { code, label, dateDebut, dateFin, isActive } = body

    if (!code || !label || !dateDebut || !dateFin) {
      return NextResponse.json(
        { error: 'Code, label, dateDebut et dateFin sont requis' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const existing = await db
      .select()
      .from(periodesScolaires)
      .where(eq(periodesScolaires.code, code))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Le code ${code} existe déjà` },
        { status: 400 }
      )
    }

    const [inserted] = await db
      .insert(periodesScolaires)
      .values({
        code,
        label,
        dateDebut,
        dateFin,
        isActive: isActive ?? true,
      })
      .returning()

    return NextResponse.json({ data: inserted }, { status: 201 })
  } catch (error) {
    console.error('Error creating période:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
