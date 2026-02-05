import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/server'
import { count } from 'drizzle-orm'
import {
  collaborateurs,
  remplacants,
  etablissements,
  ecoles,
  classes,
  directeurs,
  titulaires,
  collaborateurEcoles,
  titulaireAffectations,
  directeurRemplacements,
  titulaireRemplacements,
  ecoleTaux,
} from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const { type } = body

    let deleted = 0

    switch (type) {
      case 'collaborateurs': {
        // Compter avant suppression
        const [{ value }] = await db.select({ value: count() }).from(collaborateurs)
        deleted = value
        // Les collaborateurEcoles et remplacantObservateurs seront supprimés en cascade
        await db.delete(collaborateurs)
        break
      }

      case 'remplacants': {
        // Compter avant suppression
        const [{ value }] = await db.select({ value: count() }).from(remplacants)
        deleted = value
        // Les remplacantRemarques et remplacantObservateurs seront supprimés en cascade
        await db.delete(remplacants)
        break
      }

      case 'etablissements': {
        // Compter avant suppression
        const [{ value }] = await db.select({ value: count() }).from(etablissements)
        deleted = value
        // Supprimer dans l'ordre pour éviter les problèmes de FK
        // 1. Tables de liaison et remplacements (qui référencent ecoles)
        await db.delete(titulaireRemplacements)
        await db.delete(directeurRemplacements)
        await db.delete(titulaireAffectations)
        await db.delete(collaborateurEcoles)
        // 2. Classes (cascade depuis ecoles, mais on le fait explicitement)
        await db.delete(classes)
        // 3. Écoles
        await db.delete(ecoles)
        // 4. Établissements
        await db.delete(etablissements)
        break
      }

      case 'directeurs-titulaires': {
        // Compter avant suppression
        const [{ valueD }] = await db.select({ valueD: count() }).from(directeurs)
        const [{ valueT }] = await db.select({ valueT: count() }).from(titulaires)
        deleted = valueD + valueT
        // Supprimer les remplacements d'abord
        await db.delete(titulaireRemplacements)
        await db.delete(directeurRemplacements)
        // Supprimer les affectations
        await db.delete(titulaireAffectations)
        // Note: la FK est set null sur ecoles.directeurId, donc on peut supprimer directement
        await db.delete(directeurs)
        await db.delete(titulaires)
        break
      }

      case 'planning': {
        // Supprimer TOUT le planning : établissements, écoles, directeurs, titulaires, affectations
        // Les périodes scolaires sont conservées (table de référence)
        const [{ countEtab }] = await db.select({ countEtab: count() }).from(etablissements)
        const [{ countEcole }] = await db.select({ countEcole: count() }).from(ecoles)
        const [{ countDir }] = await db.select({ countDir: count() }).from(directeurs)
        const [{ countTit }] = await db.select({ countTit: count() }).from(titulaires)
        deleted = countEtab + countEcole + countDir + countTit

        // Supprimer dans l'ordre pour éviter les problèmes de FK
        // 1. Tables de liaison et remplacements
        await db.delete(titulaireRemplacements)
        await db.delete(directeurRemplacements)
        await db.delete(titulaireAffectations)
        await db.delete(collaborateurEcoles)
        await db.delete(ecoleTaux)
        // 2. Classes
        await db.delete(classes)
        // 3. Écoles
        await db.delete(ecoles)
        // 4. Établissements
        await db.delete(etablissements)
        // 5. Directeurs et titulaires
        await db.delete(directeurs)
        await db.delete(titulaires)
        break
      }

      default:
        return NextResponse.json({ error: 'Type de purge invalide' }, { status: 400 })
    }

    return NextResponse.json({ data: { type, deleted }, deleted })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'Non authentifié') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message === 'Accès non autorisé') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Error in purge:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
