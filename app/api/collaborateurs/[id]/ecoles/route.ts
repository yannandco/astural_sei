import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collaborateurEcoles, ecoles, classes, etablissements, periodesScolaires } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const data = await db
      .select({
        id: collaborateurEcoles.id,
        collaborateurId: collaborateurEcoles.collaborateurId,
        ecoleId: collaborateurEcoles.ecoleId,
        classeId: collaborateurEcoles.classeId,
        periodeId: collaborateurEcoles.periodeId,
        dateDebut: collaborateurEcoles.dateDebut,
        dateFin: collaborateurEcoles.dateFin,
        joursPresence: collaborateurEcoles.joursPresence,
        isActive: collaborateurEcoles.isActive,
        ecoleName: ecoles.name,
        classeName: classes.name,
        etablissementName: etablissements.name,
        periodeCode: periodesScolaires.code,
        periodeLabel: periodesScolaires.label,
      })
      .from(collaborateurEcoles)
      .leftJoin(ecoles, eq(collaborateurEcoles.ecoleId, ecoles.id))
      .leftJoin(classes, eq(collaborateurEcoles.classeId, classes.id))
      .leftJoin(etablissements, eq(ecoles.etablissementId, etablissements.id))
      .leftJoin(periodesScolaires, eq(collaborateurEcoles.periodeId, periodesScolaires.id))
      .where(eq(collaborateurEcoles.collaborateurId, collaborateurId))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching collaborateur ecoles:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { ecoleId, classeId, periodeId, dateDebut, dateFin, joursPresence } = body

    if (!ecoleId) {
      return NextResponse.json({ error: "L'école est requise" }, { status: 400 })
    }

    // Serialize joursPresence to JSON string if it's an array
    const joursPresenceJson = Array.isArray(joursPresence) ? JSON.stringify(joursPresence) : joursPresence || null

    const [created] = await db
      .insert(collaborateurEcoles)
      .values({
        collaborateurId,
        ecoleId,
        classeId: classeId || null,
        periodeId: periodeId || null,
        dateDebut: dateDebut || null,
        dateFin: dateFin || null,
        joursPresence: joursPresenceJson,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating collaborateur-ecole:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
