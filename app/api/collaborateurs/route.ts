import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, ilike, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collaborateurs, sectors, collaborateurEcoles, ecoles } from '@/lib/db/schema'
import { requireRole, requireAuth } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'user'])

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const secteurId = searchParams.get('secteurId')
    const contratType = searchParams.get('contratType')
    const isActive = searchParams.get('isActive')

    const conditions = []

    if (search) {
      conditions.push(
        sql`(${ilike(collaborateurs.lastName, `%${search}%`)} OR ${ilike(collaborateurs.firstName, `%${search}%`)} OR ${ilike(collaborateurs.email, `%${search}%`)})`
      )
    }

    if (secteurId) {
      conditions.push(eq(collaborateurs.secteurId, parseInt(secteurId)))
    }

    if (contratType && ['CDI', 'CDD', 'Mixte'].includes(contratType)) {
      conditions.push(eq(collaborateurs.contratType, contratType as 'CDI' | 'CDD' | 'Mixte'))
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      conditions.push(eq(collaborateurs.isActive, isActive === 'true'))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const collabData = await db
      .select({
        id: collaborateurs.id,
        lastName: collaborateurs.lastName,
        firstName: collaborateurs.firstName,
        address: collaborateurs.address,
        postalCode: collaborateurs.postalCode,
        city: collaborateurs.city,
        mobilePro: collaborateurs.mobilePro,
        email: collaborateurs.email,
        secteurId: collaborateurs.secteurId,
        taux: collaborateurs.taux,
        contratType: collaborateurs.contratType,
        contratDetails: collaborateurs.contratDetails,
        canton: collaborateurs.canton,
        pays: collaborateurs.pays,
        sexe: collaborateurs.sexe,
        dateSortie: collaborateurs.dateSortie,
        isActive: collaborateurs.isActive,
        createdAt: collaborateurs.createdAt,
        updatedAt: collaborateurs.updatedAt,
        secteurName: sectors.name,
        secteurColor: sectors.color,
      })
      .from(collaborateurs)
      .leftJoin(sectors, eq(collaborateurs.secteurId, sectors.id))
      .where(whereClause)
      .orderBy(asc(collaborateurs.lastName), asc(collaborateurs.firstName))

    // Récupérer les affectations d'écoles pour tous les collaborateurs
    const collabIds = collabData.map(c => c.id)

    let affectationsMap: Map<number, Array<{ id: number; name: string }>> = new Map()

    if (collabIds.length > 0) {
      const affectations = await db
        .select({
          collaborateurId: collaborateurEcoles.collaborateurId,
          ecoleId: ecoles.id,
          ecoleName: ecoles.name,
        })
        .from(collaborateurEcoles)
        .innerJoin(ecoles, eq(collaborateurEcoles.ecoleId, ecoles.id))
        .where(eq(collaborateurEcoles.isActive, true))

      // Grouper par collaborateur
      for (const aff of affectations) {
        if (!affectationsMap.has(aff.collaborateurId)) {
          affectationsMap.set(aff.collaborateurId, [])
        }
        const ecolesList = affectationsMap.get(aff.collaborateurId)!
        // Éviter les doublons
        if (!ecolesList.some(e => e.id === aff.ecoleId)) {
          ecolesList.push({ id: aff.ecoleId, name: aff.ecoleName })
        }
      }
    }

    // Ajouter les écoles à chaque collaborateur
    const data = collabData.map(collab => ({
      ...collab,
      ecoles: affectationsMap.get(collab.id) || [],
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching collaborateurs:', error)
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
    const { lastName, firstName, address, postalCode, city, mobilePro, email, secteurId, taux, contratType, contratDetails, canton, pays, sexe, dateSortie } = body

    if (!lastName || !firstName) {
      return NextResponse.json({ error: 'Nom et prénom sont requis' }, { status: 400 })
    }

    const [newCollab] = await db
      .insert(collaborateurs)
      .values({
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        address: address?.trim() || null,
        postalCode: postalCode?.trim() || null,
        city: city?.trim() || null,
        mobilePro: mobilePro?.trim() || null,
        email: email?.trim() || null,
        secteurId: secteurId || null,
        taux: taux || null,
        contratType: contratType || null,
        contratDetails: contratDetails?.trim() || null,
        canton: canton?.trim() || null,
        pays: pays?.trim() || null,
        sexe: sexe || null,
        dateSortie: dateSortie || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    return NextResponse.json({ data: newCollab }, { status: 201 })
  } catch (error) {
    console.error('Error creating collaborateur:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
