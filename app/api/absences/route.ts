import { NextRequest, NextResponse } from 'next/server'
import { sql, eq, and, lte, gte, desc, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { absences, collaborateurs, remplacants, remplacantAffectations, collaborateurEcoles, ecoles, whatsappMessages } from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') || ''
    const motif = searchParams.get('motif') || ''
    const showAll = searchParams.get('showAll') === 'true'

    const today = new Date().toISOString().split('T')[0]

    const conditions: ReturnType<typeof sql>[] = []

    // By default, only show current/future absences
    if (!showAll) {
      conditions.push(sql`${absences.dateFin} >= ${today}`)
    }

    // Filter by type
    if (type) {
      conditions.push(sql`${absences.type} = ${type}`)
    }

    // Filter by motif
    if (motif) {
      conditions.push(sql`${absences.motif} = ${motif}`)
    }

    // Search by name
    if (search) {
      const searchPattern = `%${search}%`
      conditions.push(sql`(
        ${ilike(collaborateurs.lastName, searchPattern)}
        OR ${ilike(collaborateurs.firstName, searchPattern)}
        OR ${ilike(remplacants.lastName, searchPattern)}
        OR ${ilike(remplacants.firstName, searchPattern)}
      )`)
    }

    const whereClause = conditions.length > 0
      ? sql.join(conditions, sql` AND `)
      : sql`1=1`

    const data = await db
      .select({
        id: absences.id,
        type: absences.type,
        collaborateurId: absences.collaborateurId,
        remplacantId: absences.remplacantId,
        dateDebut: absences.dateDebut,
        dateFin: absences.dateFin,
        creneau: absences.creneau,
        motif: absences.motif,
        motifDetails: absences.motifDetails,
        isActive: absences.isActive,
        // Collaborateur name
        collaborateurFirstName: collaborateurs.firstName,
        collaborateurLastName: collaborateurs.lastName,
        // Remplacant name
        remplacantFirstName: remplacants.firstName,
        remplacantLastName: remplacants.lastName,
      })
      .from(absences)
      .leftJoin(collaborateurs, sql`${absences.collaborateurId} = ${collaborateurs.id}`)
      .leftJoin(remplacants, sql`${absences.remplacantId} = ${remplacants.id}`)
      .where(whereClause)
      .orderBy(desc(absences.dateDebut))

    // Enrich: check replacement status for collaborateur absences + get écoles
    const enriched = await Promise.all(
      data.map(async (row) => {
        let isRemplacee = false
        let remplacementRemplacantId: number | null = null
        let remplacementRemplacantNom: string | null = null
        let remplacementRemplacantPrenom: string | null = null
        let collaborateurEcolesList: { id: number; name: string; joursPresence: string | null }[] = []

        if (row.type === 'collaborateur' && row.collaborateurId) {
          // Check if there's an active affectation covering this absence
          const remplacement = await db
            .select({
              id: remplacantAffectations.id,
              remplacantId: remplacantAffectations.remplacantId,
              remplacantNom: remplacants.lastName,
              remplacantPrenom: remplacants.firstName,
            })
            .from(remplacantAffectations)
            .leftJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
            .where(
              and(
                eq(remplacantAffectations.collaborateurId, row.collaborateurId),
                eq(remplacantAffectations.isActive, true),
                lte(remplacantAffectations.dateDebut, row.dateFin),
                gte(remplacantAffectations.dateFin, row.dateDebut)
              )
            )
            .limit(1)

          if (remplacement.length > 0) {
            isRemplacee = true
            remplacementRemplacantId = remplacement[0].remplacantId
            remplacementRemplacantNom = remplacement[0].remplacantNom
            remplacementRemplacantPrenom = remplacement[0].remplacantPrenom
          }

          // Get collaborateur's écoles for the assignment modal + WhatsApp
          const ecolesData = await db
            .select({
              ecoleId: collaborateurEcoles.ecoleId,
              ecoleName: ecoles.name,
              joursPresence: collaborateurEcoles.joursPresence,
            })
            .from(collaborateurEcoles)
            .leftJoin(ecoles, eq(collaborateurEcoles.ecoleId, ecoles.id))
            .where(eq(collaborateurEcoles.collaborateurId, row.collaborateurId))

          collaborateurEcolesList = ecolesData
            .filter((e, i, arr) => arr.findIndex(x => x.ecoleId === e.ecoleId) === i)
            .map(e => ({ id: e.ecoleId, name: e.ecoleName || '', joursPresence: e.joursPresence || null }))
        }

        // Get WhatsApp message responses for this absence
        const waMessages = await db
          .select({
            id: whatsappMessages.id,
            remplacantId: whatsappMessages.remplacantId,
            response: whatsappMessages.response,
            remplacantNom: remplacants.lastName,
            remplacantPrenom: remplacants.firstName,
          })
          .from(whatsappMessages)
          .leftJoin(remplacants, eq(whatsappMessages.remplacantId, remplacants.id))
          .where(eq(whatsappMessages.absenceId, row.id))

        const whatsappSent = waMessages.length
        const whatsappDisponible = waMessages.filter(m => m.response === 'disponible')
        const whatsappPasDisponible = waMessages.filter(m => m.response === 'pas_disponible')
        const whatsappEnAttente = waMessages.filter(m => !m.response)

        return {
          ...row,
          personFirstName: row.type === 'collaborateur' ? row.collaborateurFirstName : row.remplacantFirstName,
          personLastName: row.type === 'collaborateur' ? row.collaborateurLastName : row.remplacantLastName,
          personId: row.type === 'collaborateur' ? row.collaborateurId : row.remplacantId,
          isRemplacee,
          remplacementRemplacantId,
          remplacementRemplacantNom,
          remplacementRemplacantPrenom,
          collaborateurEcoles: collaborateurEcolesList,
          whatsappSent,
          whatsappDisponible: whatsappDisponible.map(m => ({
            remplacantId: m.remplacantId,
            nom: m.remplacantNom,
            prenom: m.remplacantPrenom,
          })),
          whatsappPasDisponible: whatsappPasDisponible.length,
          whatsappEnAttente: whatsappEnAttente.length,
        }
      })
    )

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('Error fetching absences:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
