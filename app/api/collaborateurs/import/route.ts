import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { collaborateurs, sectors } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

function parseName(raw: string): { lastName: string; firstName: string } {
  if (!raw || !raw.trim()) return { lastName: '', firstName: '' }

  const trimmed = raw.trim()

  // Try splitting on case boundary: "Marie DUPONT" → firstName: "Marie", lastName: "DUPONT"
  // Look for transition from mixed case to uppercase (firstName followed by LASTNAME)
  const match = trimmed.match(/^(.+?)\s+([A-ZÀ-Ü\s-]+)$/)
  if (match) {
    const first = match[1].trim()
    const last = match[2].trim().toUpperCase()
    return { lastName: last, firstName: first }
  }

  // Fallback: split on last space (assume "Prénom Nom")
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const first = parts.slice(0, -1).join(' ')
    const last = parts[parts.length - 1].toUpperCase()
    return { lastName: last, firstName: first }
  }

  return { lastName: trimmed.toUpperCase(), firstName: '' }
}

function parseExcelDate(value: unknown): string | null {
  if (!value) return null

  // If it's a number, it's an Excel serial date
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      const y = date.y < 100 ? date.y + 2000 : date.y
      return `${y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }
    return null
  }

  const str = String(value).trim()
  if (!str) return null

  // Try M/D/YY or M/D/YYYY format
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, '0')
    const d = slashMatch[2].padStart(2, '0')
    let y = parseInt(slashMatch[3])
    if (y < 100) y += 2000
    return `${y}-${m}-${d}`
  }

  // Try ISO format
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return isoMatch[0]

  return null
}

function parseContratType(value: unknown): 'CDI' | 'CDD' | 'Mixte' | null {
  if (!value) return null
  const str = String(value).trim().toUpperCase()
  if (str === 'CDI') return 'CDI'
  if (str === 'CDD') return 'CDD'
  if (str === 'MIXTE') return 'Mixte'
  return null
}

function parseSexe(value: unknown): 'M' | 'F' | null {
  if (!value) return null
  const str = String(value).trim().toUpperCase()
  if (str === 'M' || str === 'H' || str === 'HOMME' || str === 'MASCULIN') return 'M'
  if (str === 'F' || str === 'FEMME' || str === 'FÉMININ' || str === 'FEMININ') return 'F'
  return null
}

function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key]
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim()
    }
  }
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireRole(['admin'])

    const { searchParams } = new URL(request.url)
    const previewMode = searchParams.get('preview') === 'true'

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 })
    }

    // Extract actual column names from first row for debugging
    const detectedColumns = rows.length > 0 ? Object.keys(rows[0]) : []

    // Get existing sectors for lookup
    const existingSectors = await db.select().from(sectors)
    const sectorMap = new Map(existingSectors.map(s => [s.name.toLowerCase(), s.id]))

    const parsed: Array<{
      row: number
      data: Record<string, unknown>
      error?: string
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 1-indexed + header row

      try {
        // Map column names (flexible matching)
        const rawName = getCell(row, 'Nom collaborateur', 'Nom', 'nom', 'NOM', 'Nom Prénom', 'nom prenom')
        const rawLastName = getCell(row, 'Nom de famille', 'Last Name', 'lastName')
        const rawFirstName = getCell(row, 'Prénom', 'Prenom', 'prenom', 'First Name', 'firstName')

        let lastName: string
        let firstName: string

        if (rawLastName || rawFirstName) {
          lastName = String(rawLastName).trim()
          firstName = String(rawFirstName).trim()
        } else {
          const parsed = parseName(String(rawName))
          lastName = parsed.lastName
          firstName = parsed.firstName
        }

        if (!lastName) {
          parsed.push({ row: rowNum, data: row, error: 'Nom manquant' })
          continue
        }

        const secteurRaw = getCell(row, 'Secteur principal', 'Secteur', 'secteur', 'SECTEUR')
        let secteurId: number | null = null

        if (secteurRaw && secteurRaw.trim()) {
          const sectorName = secteurRaw.trim()
          const existing = sectorMap.get(sectorName.toLowerCase())
          if (existing) {
            secteurId = existing
          } else if (!previewMode) {
            // Auto-create the sector
            const [newSector] = await db
              .insert(sectors)
              .values({ name: sectorName })
              .returning()
            sectorMap.set(sectorName.toLowerCase(), newSector.id)
            secteurId = newSector.id
          }
        }

        const data = {
          lastName,
          firstName: firstName || '',
          address: getCell(row, 'Adresse', 'adresse') || null,
          postalCode: getCell(row, 'Code postal', 'Code Postal', 'CP', 'cp') || null,
          city: getCell(row, 'Ville', 'ville', 'Localité') || null,
          mobilePro: getCell(row, 'Mobile professionnel', 'Mobile', 'mobile', 'Tél', 'Tel', 'Téléphone') || null,
          email: getCell(row, 'Email', 'email', 'E-mail', 'Mail') || null,
          secteurId,
          secteurName: secteurRaw || null,
          taux: getCell(row, 'Taux', 'taux') || null,
          contratType: parseContratType(row['Contrat'] || row['contrat'] || row['Type contrat'] || row['Contrat Type']),
          contratDetails: getCell(row, 'Détails contrat', 'Details contrat') || null,
          canton: getCell(row, 'Canton', 'canton') || null,
          pays: getCell(row, 'Pays', 'pays') || null,
          sexe: parseSexe(row['Sexe'] || row['sexe'] || row['Genre']),
          dateSortie: parseExcelDate(row['Date de sortie'] || row['Date sortie'] || row['date_sortie']),
        }

        parsed.push({ row: rowNum, data })
      } catch {
        parsed.push({ row: rowNum, data: row, error: 'Erreur de parsing' })
      }
    }

    if (previewMode) {
      return NextResponse.json({
        total: rows.length,
        valid: parsed.filter(p => !p.error).length,
        errors: parsed.filter(p => p.error),
        preview: parsed,
      })
    }

    // Upsert valid rows (match on email first, then lastName+firstName fallback)
    const errors: Array<{ row: number; message: string }> = []
    let created = 0
    let updated = 0

    for (const item of parsed) {
      if (item.error) {
        errors.push({ row: item.row, message: item.error })
        continue
      }

      try {
        const d = item.data as Record<string, unknown>
        const email = d.email as string | null
        const lastName = d.lastName as string
        const firstName = d.firstName as string

        // Find existing: by email first, then by lastName+firstName
        let existing = null
        if (email) {
          const [found] = await db
            .select({ id: collaborateurs.id })
            .from(collaborateurs)
            .where(eq(collaborateurs.email, email))
            .limit(1)
          existing = found || null
        }
        if (!existing) {
          const [found] = await db
            .select({ id: collaborateurs.id })
            .from(collaborateurs)
            .where(and(eq(collaborateurs.lastName, lastName), eq(collaborateurs.firstName, firstName)))
            .limit(1)
          existing = found || null
        }

        const values = {
          lastName,
          firstName,
          address: d.address as string | null,
          postalCode: d.postalCode as string | null,
          city: d.city as string | null,
          mobilePro: d.mobilePro as string | null,
          email,
          secteurId: d.secteurId as number | null,
          taux: d.taux ? String(d.taux) : null,
          contratType: d.contratType as 'CDI' | 'CDD' | 'Mixte' | null,
          contratDetails: d.contratDetails as string | null,
          canton: d.canton as string | null,
          pays: d.pays as string | null,
          sexe: d.sexe as 'M' | 'F' | null,
          dateSortie: d.dateSortie as string | null,
        }

        if (existing) {
          await db
            .update(collaborateurs)
            .set({ ...values, updatedAt: new Date(), updatedBy: user.id })
            .where(eq(collaborateurs.id, existing.id))
          updated++
        } else {
          await db.insert(collaborateurs).values({
            ...values,
            createdBy: user.id,
            updatedBy: user.id,
          })
          created++
        }
      } catch (err) {
        errors.push({ row: item.row, message: (err as Error).message })
      }
    }

    return NextResponse.json({ imported: created, updated, errors })
  } catch (error) {
    console.error('Error importing collaborateurs:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
