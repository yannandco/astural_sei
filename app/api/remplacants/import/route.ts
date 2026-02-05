import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { remplacants, remplacantRemarques } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

/**
 * Converts a string to proper case (capitalize first letter of each word/segment)
 * Handles compound names with hyphens: "MARIE-CLAIRE" → "Marie-Claire"
 * Handles multiple first names: "MARIE ANNE" → "Marie Anne"
 */
function toProperCase(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(/(\s+|-)/)
    .map(part => {
      if (part.match(/^\s+$/) || part === '-') return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('')
}

function parseName(raw: string): { lastName: string; firstName: string } {
  if (!raw || !raw.trim()) return { lastName: '', firstName: '' }

  let trimmed = raw.trim()

  // Remove prefix like "zz. " or "aa. " at the beginning
  trimmed = trimmed.replace(/^[a-z]+\.\s*/i, '')

  // Format: "NOM Prénom" — uppercase part is the lastName, rest is firstName
  // Example: "DUPONT Marie" → lastName: "DUPONT", firstName: "Marie"
  // Example: "DE LA FONTAINE Jean-Pierre" → lastName: "DE LA FONTAINE", firstName: "Jean-Pierre"

  // Look for uppercase words at the beginning followed by mixed-case words
  const match = trimmed.match(/^([A-ZÀ-Ü][A-ZÀ-Ü\s-]*[A-ZÀ-Ü])\s+(.+)$/)
  if (match) {
    const last = match[1].trim().toUpperCase()
    const first = toProperCase(match[2].trim())
    return { lastName: last, firstName: first }
  }

  // Single uppercase word followed by rest: "DUPONT Marie"
  const singleMatch = trimmed.match(/^([A-ZÀ-Ü]+)\s+(.+)$/)
  if (singleMatch) {
    const last = singleMatch[1].trim().toUpperCase()
    const first = toProperCase(singleMatch[2].trim())
    return { lastName: last, firstName: first }
  }

  // Fallback: split on first space (assume "Nom Prénom")
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const last = parts[0].toUpperCase()
    const first = toProperCase(parts.slice(1).join(' '))
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

  // Try M/D/YY or M/D/YYYY format (as specified by user)
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

function parseAvailability(value: unknown): boolean {
  if (!value) return true // Default: available

  const str = String(value).trim().toLowerCase()

  // Disponible: oui, disponible, yes, o, 1
  if (str === 'oui' || str === 'disponible' || str === 'yes' || str === 'o' || str === '1') {
    return true
  }

  // Indisponible: non, indisponible, non disponible, no, n, 0
  if (str === 'non' || str.includes('indisponible') || str.includes('non') || str === 'no' || str === 'n' || str === '0') {
    return false
  }

  // Default: available
  return true
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

    // Find the sheet - look for "Liste rempl." or similar, fallback to first sheet
    let sheetName = workbook.SheetNames.find(s =>
      s.toLowerCase().includes('rempl') || s.toLowerCase().includes('liste')
    ) || workbook.SheetNames[0]

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 })
    }

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
        const rawName = getCell(row, 'Noms', 'Nom', 'nom', 'NOM', 'Nom Prénom')

        // Skip totals/summary rows
        if (rawName.toLowerCase().includes('totaux') || rawName.toLowerCase().includes('total')) {
          continue
        }

        const { lastName, firstName } = parseName(rawName)

        if (!lastName) {
          parsed.push({ row: rowNum, data: row, error: 'Nom manquant' })
          continue
        }

        // Parse availability
        const disponibleRaw = getCell(row,
          'Disponible période actuelle',
          'Disponible periode actuelle',
          'Disponible',
          'disponible'
        )
        const isAvailable = parseAvailability(disponibleRaw)

        // Get remarque content (column with date in header)
        const remarqueContent = getCell(row,
          'Remarques maj le 28.11.25 vg',
          'Remarques maj le 28.11.25',
          'Remarques',
          'remarques'
        )

        // Get contract dates - need raw values for Excel serial dates
        // Use flexible key matching to handle variations in column names
        const findKey = (row: Record<string, unknown>, ...patterns: string[]): unknown => {
          for (const key of Object.keys(row)) {
            const keyLower = key.toLowerCase().trim()
            for (const pattern of patterns) {
              if (keyLower.includes(pattern.toLowerCase())) {
                return row[key]
              }
            }
          }
          return null
        }
        const contractStartRaw = findKey(row, 'contrat horaire du', 'début contrat', 'debut contrat')
        const contractEndRaw = findKey(row, 'fin contrat', 'fin contrat horaire')

        const data = {
          lastName,
          firstName: firstName || '',
          address: getCell(row, 'Adresse', 'adresse') || null,
          phone: getCell(row, 'Téléphone', 'Telephone', 'Tel', 'tel', 'Phone') || null,
          email: getCell(row, 'Email', 'email', 'E-mail', 'Mail') || null,
          isAvailable,
          contractStartDate: parseExcelDate(contractStartRaw) || null,
          contractEndDate: parseExcelDate(contractEndRaw) || null,
          obsTemporaire: getCell(row, 'Obs', 'obs', 'Observation', 'observation') || null,
          remarqueContent: remarqueContent || null,
        }

        parsed.push({ row: rowNum, data })
      } catch {
        parsed.push({ row: rowNum, data: row, error: 'Erreur de parsing' })
      }
    }

    // Get detected column names for debugging
    const detectedColumns = rows.length > 0 ? Object.keys(rows[0]) : []

    if (previewMode) {
      return NextResponse.json({
        total: rows.length,
        valid: parsed.filter(p => !p.error).length,
        errors: parsed.filter(p => p.error),
        preview: parsed,
        detectedColumns,
        sheetName,
      })
    }

    // Upsert valid rows
    const errors: Array<{ row: number; message: string }> = []
    let created = 0
    let updated = 0
    let remarquesCreated = 0

    // Fixed date for backdated remarques: 28/11/2025
    const remarqueDate = new Date('2025-11-28T12:00:00Z')

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
            .select({ id: remplacants.id })
            .from(remplacants)
            .where(eq(remplacants.email, email))
            .limit(1)
          existing = found || null
        }
        if (!existing) {
          const [found] = await db
            .select({ id: remplacants.id })
            .from(remplacants)
            .where(and(eq(remplacants.lastName, lastName), eq(remplacants.firstName, firstName)))
            .limit(1)
          existing = found || null
        }

        const values = {
          lastName,
          firstName,
          address: d.address as string | null,
          phone: d.phone as string | null,
          email,
          isAvailable: d.isAvailable as boolean,
          contractStartDate: d.contractStartDate as string | null,
          contractEndDate: d.contractEndDate as string | null,
          obsTemporaire: d.obsTemporaire as string | null,
        }

        let remplacantId: number

        if (existing) {
          await db
            .update(remplacants)
            .set({ ...values, updatedAt: new Date(), updatedBy: user.id })
            .where(eq(remplacants.id, existing.id))
          remplacantId = existing.id
          updated++
        } else {
          const [inserted] = await db.insert(remplacants).values({
            ...values,
            createdBy: user.id,
            updatedBy: user.id,
          }).returning()
          remplacantId = inserted.id
          created++
        }

        // Create remarque entry if content exists
        const remarqueContent = d.remarqueContent as string | null
        if (remarqueContent) {
          await db.insert(remplacantRemarques).values({
            remplacantId,
            content: remarqueContent,
            createdBy: user.id,
            createdAt: remarqueDate,
          })
          remarquesCreated++
        }

      } catch (err) {
        errors.push({ row: item.row, message: (err as Error).message })
      }
    }

    return NextResponse.json({ imported: created, updated, remarquesCreated, errors })
  } catch (error) {
    console.error('Error importing remplacants:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
