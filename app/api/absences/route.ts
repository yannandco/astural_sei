import { NextRequest, NextResponse } from 'next/server'
import { sql, eq, and, or, lte, gte, desc, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { absences, collaborateurs, remplacants, remplacantAffectations, collaborateurEcoles, ecoles, whatsappMessages } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'
import { computeEcoleUrgency, computeOverallUrgency, getUrgencySortValue, type EcoleUrgency } from '@/lib/urgency'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'user'])

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
        let replacementStatus: 'none' | 'partial' | 'full' = 'none'
        let isRemplacee = false
        let remplacementRemplacantId: number | null = null
        let remplacementRemplacantNom: string | null = null
        let remplacementRemplacantPrenom: string | null = null
        let collaborateurEcolesList: { id: number; name: string; joursPresence: string | null; remplacementApresJours: string | null }[] = []
        let remplacantsList: { id: number; nom: string | null; prenom: string | null }[] = []

        if (row.type === 'collaborateur' && row.collaborateurId) {
          // Check if there's an active affectation covering this absence (with créneau matching)
          const creneauCondition = row.creneau === 'journee'
            ? undefined
            : or(
                eq(remplacantAffectations.creneau, row.creneau),
                eq(remplacantAffectations.creneau, 'journee')
              )

          const remplacementConditions = [
            eq(remplacantAffectations.collaborateurId, row.collaborateurId),
            eq(remplacantAffectations.isActive, true),
            lte(remplacantAffectations.dateDebut, row.dateFin),
            gte(remplacantAffectations.dateFin, row.dateDebut),
          ]
          if (creneauCondition) remplacementConditions.push(creneauCondition)

          const remplacement = await db
            .select({
              id: remplacantAffectations.id,
              remplacantId: remplacantAffectations.remplacantId,
              remplacantNom: remplacants.lastName,
              remplacantPrenom: remplacants.firstName,
              dateDebut: remplacantAffectations.dateDebut,
              dateFin: remplacantAffectations.dateFin,
              creneau: remplacantAffectations.creneau,
            })
            .from(remplacantAffectations)
            .leftJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
            .where(and(...remplacementConditions))

          // Deduplicate remplaçants by id
          const remplacantsMap = new Map<number, { id: number; nom: string | null; prenom: string | null }>()
          for (const r of remplacement) {
            if (r.remplacantId && !remplacantsMap.has(r.remplacantId)) {
              remplacantsMap.set(r.remplacantId, { id: r.remplacantId, nom: r.remplacantNom, prenom: r.remplacantPrenom })
            }
          }
          remplacantsList = Array.from(remplacantsMap.values())

          // Get collaborateur's écoles for the assignment modal + WhatsApp
          const ecolesData = await db
            .select({
              ecoleId: collaborateurEcoles.ecoleId,
              ecoleName: ecoles.name,
              joursPresence: collaborateurEcoles.joursPresence,
              remplacementApresJours: ecoles.remplacementApresJours,
            })
            .from(collaborateurEcoles)
            .leftJoin(ecoles, eq(collaborateurEcoles.ecoleId, ecoles.id))
            .where(eq(collaborateurEcoles.collaborateurId, row.collaborateurId))

          collaborateurEcolesList = ecolesData
            .filter((e, i, arr) => arr.findIndex(x => x.ecoleId === e.ecoleId) === i)
            .map(e => ({ id: e.ecoleId, name: e.ecoleName || '', joursPresence: e.joursPresence || null, remplacementApresJours: e.remplacementApresJours }))

          if (remplacement.length > 0) {
            isRemplacee = true
            remplacementRemplacantId = remplacement[0].remplacantId
            remplacementRemplacantNom = remplacement[0].remplacantNom
            remplacementRemplacantPrenom = remplacement[0].remplacantPrenom

            // Build presence schedule from all écoles: jour → Set<creneau>
            const jourNamesByDow: Record<number, string> = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi' }
            const presenceMap = new Map<string, Set<string>>() // jour → creneaux
            for (const ecole of collaborateurEcolesList) {
              if (ecole.joursPresence) {
                try {
                  const jp: { jour: string; creneau: string }[] = JSON.parse(ecole.joursPresence)
                  for (const entry of jp) {
                    const existing = presenceMap.get(entry.jour) || new Set()
                    existing.add(entry.creneau)
                    presenceMap.set(entry.jour, existing)
                  }
                } catch { /* ignore */ }
              }
            }
            const hasPresenceData = presenceMap.size > 0

            // Compute coverage: generate slots based on actual presence schedule
            const absStart = new Date(row.dateDebut + 'T00:00:00')
            const absEnd = new Date(row.dateFin + 'T00:00:00')
            const slots: string[] = [] // "YYYY-MM-DD:creneau" keys
            const cur = new Date(absStart)
            while (cur <= absEnd) {
              const dow = cur.getDay()
              if (dow >= 1 && dow <= 5) {
                const d = cur.toISOString().split('T')[0]
                const jourName = jourNamesByDow[dow]

                if (hasPresenceData) {
                  // Use actual presence schedule
                  const creneaux = presenceMap.get(jourName)
                  if (creneaux) {
                    // Merge matin+apres_midi into journee if both present
                    const hasMatin = creneaux.has('matin')
                    const hasAM = creneaux.has('apres_midi')
                    const hasJournee = creneaux.has('journee')

                    if (row.creneau === 'journee') {
                      if (hasJournee || (hasMatin && hasAM)) {
                        slots.push(`${d}:matin`, `${d}:apres_midi`)
                      } else if (hasMatin) {
                        slots.push(`${d}:matin`)
                      } else if (hasAM) {
                        slots.push(`${d}:apres_midi`)
                      }
                    } else {
                      // Absence is matin or apres_midi only
                      if (hasJournee || creneaux.has(row.creneau)) {
                        slots.push(`${d}:${row.creneau}`)
                      }
                    }
                  }
                } else {
                  // Fallback: all weekdays
                  if (row.creneau === 'journee') {
                    slots.push(`${d}:matin`, `${d}:apres_midi`)
                  } else {
                    slots.push(`${d}:${row.creneau}`)
                  }
                }
              }
              cur.setDate(cur.getDate() + 1)
            }

            const coveredSlots = new Set<string>()
            for (const r of remplacement) {
              const rStart = new Date(r.dateDebut + 'T00:00:00')
              const rEnd = new Date(r.dateFin + 'T00:00:00')
              const rc = new Date(rStart)
              while (rc <= rEnd) {
                const dow = rc.getDay()
                if (dow >= 1 && dow <= 5) {
                  const d = rc.toISOString().split('T')[0]
                  if (r.creneau === 'journee') {
                    coveredSlots.add(`${d}:matin`)
                    coveredSlots.add(`${d}:apres_midi`)
                  } else {
                    coveredSlots.add(`${d}:${r.creneau}`)
                  }
                }
                rc.setDate(rc.getDate() + 1)
              }
            }

            const totalSlots = slots.length
            const covered = slots.filter(s => coveredSlots.has(s)).length
            if (totalSlots > 0 && covered >= totalSlots) {
              replacementStatus = 'full'
            } else if (covered > 0) {
              replacementStatus = 'partial'
            }
          }
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

        // Compute per-école urgency for collaborateur absences
        let ecoleUrgencies: EcoleUrgency[] = []
        if (row.type === 'collaborateur') {
          ecoleUrgencies = collaborateurEcolesList.map(e => {
            // Check if this specific école has a remplacement
            const ecoleIsRemplacee = isRemplacee // For now, global replacement status
            const { urgency, joursRestants } = computeEcoleUrgency(
              row.dateDebut,
              e.remplacementApresJours,
              ecoleIsRemplacee,
              today,
            )
            return {
              ecoleId: e.id,
              ecoleName: e.name,
              remplacementApresJours: e.remplacementApresJours,
              isRemplacee: ecoleIsRemplacee,
              urgency,
              joursRestants,
            }
          })
        }

        const overall = row.type === 'collaborateur'
          ? computeOverallUrgency(ecoleUrgencies)
          : { urgency: 'no_deadline' as const, joursRestants: null }

        return {
          ...row,
          personFirstName: row.type === 'collaborateur' ? row.collaborateurFirstName : row.remplacantFirstName,
          personLastName: row.type === 'collaborateur' ? row.collaborateurLastName : row.remplacantLastName,
          personId: row.type === 'collaborateur' ? row.collaborateurId : row.remplacantId,
          isRemplacee,
          replacementStatus,
          remplacementRemplacantId,
          remplacementRemplacantNom,
          remplacementRemplacantPrenom,
          remplacants: remplacantsList,
          collaborateurEcoles: collaborateurEcolesList.map(e => {
            const eu = ecoleUrgencies.find(u => u.ecoleId === e.id)
            return {
              ...e,
              isRemplacee: eu?.isRemplacee ?? false,
              urgency: eu?.urgency ?? 'no_deadline',
              joursRestants: eu?.joursRestants ?? null,
            }
          }),
          urgency: overall.urgency,
          joursRestants: overall.joursRestants,
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

    // Sort by urgency (most urgent first)
    enriched.sort((a, b) => {
      const aVal = getUrgencySortValue(a.urgency, a.joursRestants)
      const bVal = getUrgencySortValue(b.urgency, b.joursRestants)
      if (aVal !== bVal) return aVal - bVal
      // Secondary sort: dateDebut desc
      return b.dateDebut.localeCompare(a.dateDebut)
    })

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('Error fetching absences:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
