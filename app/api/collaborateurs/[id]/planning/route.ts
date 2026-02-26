import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collaborateurEcoles, ecoles } from '@/lib/db/schema'
import { remplacantAffectations } from '@/lib/db/schema/planning'
import { remplacants } from '@/lib/db/schema/remplacants'
import { requireAdminOrSelfCollaborateur } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

interface JourPresence {
  jour: 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi'
  creneau: 'matin' | 'apres_midi' | 'journee'
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    await requireAdminOrSelfCollaborateur(collaborateurId)

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get collaborateur's école affectations with joursPresence
    const affectationsData = await db
      .select({
        id: collaborateurEcoles.id,
        ecoleId: collaborateurEcoles.ecoleId,
        ecoleName: ecoles.name,
        joursPresence: collaborateurEcoles.joursPresence,
        dateDebut: collaborateurEcoles.dateDebut,
        dateFin: collaborateurEcoles.dateFin,
        isActive: collaborateurEcoles.isActive,
      })
      .from(collaborateurEcoles)
      .innerJoin(ecoles, eq(collaborateurEcoles.ecoleId, ecoles.id))
      .where(
        and(
          eq(collaborateurEcoles.collaborateurId, collaborateurId),
          eq(collaborateurEcoles.isActive, true)
        )
      )

    // Parse joursPresence JSON for each affectation
    const presences = affectationsData.map((aff) => {
      let joursPresence: JourPresence[] = []
      if (aff.joursPresence) {
        try {
          joursPresence = JSON.parse(aff.joursPresence)
        } catch {
          joursPresence = []
        }
      }

      return {
        ecoleId: aff.ecoleId,
        ecoleName: aff.ecoleName,
        joursPresence,
        dateDebut: aff.dateDebut,
        dateFin: aff.dateFin,
      }
    })

    // Get remplacements for this collaborateur in the date range
    let remplacementsData: Array<{
      id: number
      remplacantId: number
      remplacantNom: string | null
      remplacantPrenom: string | null
      ecoleId: number
      ecoleNom: string | null
      dateDebut: string
      dateFin: string
      creneau: 'matin' | 'apres_midi' | 'journee'
      motif: string | null
    }> = []

    if (startDate && endDate) {
      const replacements = await db
        .select({
          id: remplacantAffectations.id,
          remplacantId: remplacantAffectations.remplacantId,
          remplacantNom: remplacants.lastName,
          remplacantPrenom: remplacants.firstName,
          ecoleId: remplacantAffectations.ecoleId,
          ecoleNom: ecoles.name,
          dateDebut: remplacantAffectations.dateDebut,
          dateFin: remplacantAffectations.dateFin,
          creneau: remplacantAffectations.creneau,
          motif: remplacantAffectations.motif,
        })
        .from(remplacantAffectations)
        .innerJoin(remplacants, eq(remplacantAffectations.remplacantId, remplacants.id))
        .leftJoin(ecoles, eq(remplacantAffectations.ecoleId, ecoles.id))
        .where(
          and(
            eq(remplacantAffectations.collaborateurId, collaborateurId),
            // Overlap with date range
            lte(remplacantAffectations.dateDebut, endDate),
            gte(remplacantAffectations.dateFin, startDate)
          )
        )
        .orderBy(remplacantAffectations.dateDebut)

      remplacementsData = replacements.map((r) => ({
        id: r.id,
        remplacantId: r.remplacantId,
        remplacantNom: r.remplacantNom,
        remplacantPrenom: r.remplacantPrenom,
        ecoleId: r.ecoleId,
        ecoleNom: r.ecoleNom,
        dateDebut: r.dateDebut,
        dateFin: r.dateFin,
        creneau: r.creneau as 'matin' | 'apres_midi' | 'journee',
        motif: r.motif,
      }))
    }

    return NextResponse.json({
      data: {
        presences,
        remplacements: remplacementsData,
      },
    })
  } catch (error) {
    console.error('Error fetching collaborateur planning:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
