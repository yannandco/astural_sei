import { NextRequest, NextResponse } from 'next/server'
import { eq, and, or, lte, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { absences, collaborateurs, remplacants, remplacantAffectations, collaborateurEcoles, ecoles, whatsappMessages } from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth/server'
import { computeEcoleUrgency, computeOverallUrgency, type EcoleUrgency } from '@/lib/urgency'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const absenceId = parseInt(id, 10)
    if (isNaN(absenceId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]

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
        collaborateurFirstName: collaborateurs.firstName,
        collaborateurLastName: collaborateurs.lastName,
        remplacantFirstName: remplacants.firstName,
        remplacantLastName: remplacants.lastName,
      })
      .from(absences)
      .leftJoin(collaborateurs, eq(absences.collaborateurId, collaborateurs.id))
      .leftJoin(remplacants, eq(absences.remplacantId, remplacants.id))
      .where(eq(absences.id, absenceId))
      .limit(1)

    if (data.length === 0) {
      return NextResponse.json({ error: 'Absence non trouvée' }, { status: 404 })
    }

    const row = data[0]

    let replacementStatus: 'none' | 'partial' | 'full' = 'none'
    let isRemplacee = false
    let remplacementRemplacantId: number | null = null
    let remplacementRemplacantNom: string | null = null
    let remplacementRemplacantPrenom: string | null = null
    let collaborateurEcolesList: { id: number; name: string; joursPresence: string | null; remplacementApresJours: string | null }[] = []

    if (row.type === 'collaborateur' && row.collaborateurId) {
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

        // Compute coverage using presence schedule
        const jourNamesByDow: Record<number, string> = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi' }
        const presenceMap = new Map<string, Set<string>>()
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

        const absStart = new Date(row.dateDebut + 'T00:00:00')
        const absEnd = new Date(row.dateFin + 'T00:00:00')
        const slots: string[] = []
        const cur = new Date(absStart)
        while (cur <= absEnd) {
          const dow = cur.getDay()
          if (dow >= 1 && dow <= 5) {
            const d = cur.toISOString().split('T')[0]
            const jourName = jourNamesByDow[dow]
            if (hasPresenceData) {
              const creneaux = presenceMap.get(jourName)
              if (creneaux) {
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
                  if (hasJournee || creneaux.has(row.creneau)) {
                    slots.push(`${d}:${row.creneau}`)
                  }
                }
              }
            } else {
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

    // WhatsApp messages
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

    // Urgency
    let ecoleUrgencies: EcoleUrgency[] = []
    if (row.type === 'collaborateur') {
      ecoleUrgencies = collaborateurEcolesList.map(e => {
        const ecoleIsRemplacee = isRemplacee
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

    const enriched = {
      ...row,
      personFirstName: row.type === 'collaborateur' ? row.collaborateurFirstName : row.remplacantFirstName,
      personLastName: row.type === 'collaborateur' ? row.collaborateurLastName : row.remplacantLastName,
      personId: row.type === 'collaborateur' ? row.collaborateurId : row.remplacantId,
      isRemplacee,
      replacementStatus,
      remplacementRemplacantId,
      remplacementRemplacantNom,
      remplacementRemplacantPrenom,
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

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('Error fetching absence:', error)
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
