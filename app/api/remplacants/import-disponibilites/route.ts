import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { remplacants, remplacantDisponibilitesSpecifiques, remplacantRemarques, remplacantAffectations, collaborateurs, ecoles } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'
import { eq, and, ilike, sql } from 'drizzle-orm'
import type { Creneau } from '@/components/planning'

// Parse affectation note like "Rempl. Caroline pour Julie" or "Cointrin pour Lucie" or "Remplacement Odile Contamines" or just "Contamines"
function parseAffectationNote(note: string): { ecoleName: string; personName: string | null } | null {
  if (!note) return null

  // Pattern 1: "[École] pour [Personne]" or "Rempl. [École] pour [Personne]"
  const patternPour = /^(?:Rempl\.?\s*)?(.+?)\s+pour\s+(.+)$/i
  const matchPour = note.match(patternPour)
  if (matchPour) {
    return {
      ecoleName: matchPour[1].trim(),
      personName: matchPour[2].trim(),
    }
  }

  // Pattern 2: "Remplacement [Personne] [École]" or "Rempl. [Personne] [École]"
  // Format: Remplacement + Prénom + NomÉcole (2 mots minimum après Remplacement)
  const patternRemplacement = /^(?:Remplacement|Rempl\.?)\s+(\S+)\s+(.+)$/i
  const matchRemplacement = note.match(patternRemplacement)
  if (matchRemplacement) {
    return {
      personName: matchRemplacement[1].trim(),
      ecoleName: matchRemplacement[2].trim(),
    }
  }

  // Pattern 3: "[Personne] au [École]" or "[Personne] à [École]"
  const patternAu = /^(\S+)\s+(?:au|à|a)\s+(.+)$/i
  const matchAu = note.match(patternAu)
  if (matchAu) {
    return {
      personName: matchAu[1].trim(),
      ecoleName: matchAu[2].trim(),
    }
  }

  // Pattern 4: "[École] [Personne]" - two words, first is école, second is person
  // e.g., "Le-Corbusier Kelly" = école Le-Corbusier, personne Kelly
  const words = note.trim().split(/\s+/)
  if (words.length === 2) {
    return {
      ecoleName: words[0].trim(),
      personName: words[1].trim(),
    }
  }

  // Pattern 5: Just the école name (single word or phrase without "pour" or "Remplacement")
  // Skip common non-école values
  const skipValues = ['libre', 'pas dispo', 'pas disponible', 'vacances', 'congé', 'maladie', 'formation']
  const cleanNote = note.trim().toLowerCase()
  if (!skipValues.some(v => cleanNote.includes(v))) {
    return {
      ecoleName: note.trim(),
      personName: null,
    }
  }

  return null
}

interface ParsedDisponibilite {
  remplacantName: string
  date: string
  creneau: Creneau
  isAvailable: boolean
  note: string | null
}

interface ParsedRemplacant {
  name: string
  remarques: string | null
  disponibilites: ParsedDisponibilite[]
}

interface ParsedAffectationDebug {
  ecoleName: string
  personName: string | null
  ecoleFound: boolean
  ecoleId: number | null
  personFound: boolean
  personId: number | null
}

interface PreviewRow {
  row: number
  name: string
  remarques: string | null
  disponibilitesCount: number
  libres: number
  pasDispo: number
  affectations: number
  matched: boolean
  matchedId?: number
  matchedType?: 'remplacant' | 'collaborateur'
  error?: string
  // Debug: detailed disponibilités
  details?: Array<{
    date: string
    creneau: string
    isAvailable: boolean
    note: string | null
    // Debug: affectation parsing
    affectationParsed?: ParsedAffectationDebug | null
  }>
}

// Parse date from header like "lu 18", "ma 19", etc.
function parseDateFromHeader(header: string, weekHeader: string, year: number): string | null {
  if (!header || typeof header !== 'string') return null

  const dayMatch = header.match(/^(lu|ma|me|jeu?|ve)\s*(\d{1,2})$/i)
  if (!dayMatch) return null

  const dayNum = parseInt(dayMatch[2], 10)

  // Extract month from week header
  const monthPatterns = [
    { pattern: /août/i, month: 7 },
    { pattern: /sep/i, month: 8 },
    { pattern: /oct/i, month: 9 },
    { pattern: /nov/i, month: 10 },
    { pattern: /déc/i, month: 11 },
    { pattern: /jan/i, month: 0 },
    { pattern: /fév/i, month: 1 },
    { pattern: /mars/i, month: 2 },
    { pattern: /avr/i, month: 3 },
    { pattern: /mai/i, month: 4 },
    { pattern: /juin/i, month: 5 },
    { pattern: /juil/i, month: 6 },
  ]

  let month = -1
  for (const { pattern, month: m } of monthPatterns) {
    if (pattern.test(weekHeader)) {
      month = m
      break
    }
  }

  if (month === -1) return null

  // Adjust year for January onwards
  const actualYear = month < 7 ? year + 1 : year

  // Validate the date
  const date = new Date(actualYear, month, dayNum)
  if (isNaN(date.getTime())) return null

  // Format date manually to avoid timezone issues with toISOString()
  const yyyy = actualYear.toString()
  const mm = (month + 1).toString().padStart(2, '0')
  const dd = dayNum.toString().padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

// Parse cell value to determine availability
function parseCellValue(value: unknown): { isAvailable: boolean; note: string | null } | null {
  if (value === null || value === undefined || value === '') {
    return null // No data
  }

  const str = String(value).trim().toLowerCase()

  if (str === 'libre') {
    return { isAvailable: true, note: null }
  }

  if (str === 'pas dispo' || str === 'pas disponible') {
    return { isAvailable: false, note: null }
  }

  // Skip vacation/holiday markers
  if (str === 'vacances' || str === 'noël' || str === 'noel') {
    return null
  }

  // If it contains "pour" or school name, it's an assignment (not available)
  if (str.includes(' pour ') || str.includes('obs ') || str.includes('rempl.') || str.includes('remplacement')) {
    return { isAvailable: false, note: String(value).trim() }
  }

  // If it looks like a school name (capitalized or contains specific keywords)
  if (/^[A-Z]/.test(String(value).trim()) && str !== 'libre') {
    return { isAvailable: false, note: String(value).trim() }
  }

  // Default: treat as note/unavailable
  if (str.length > 0) {
    return { isAvailable: false, note: String(value).trim() }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireRole(['admin'])

    const { searchParams } = new URL(request.url)
    const isPreview = searchParams.get('preview') === 'true'

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })

    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    // Get merge information to handle merged cells properly
    const merges = sheet['!merges'] || []

    // Helper to check if a cell is part of a merge and get the merge's top-left value
    const getMergedValue = (row: number, col: number, rawData: unknown[][]): unknown => {
      for (const merge of merges) {
        // merge format: { s: { r: startRow, c: startCol }, e: { r: endRow, c: endCol } }
        if (row >= merge.s.r && row <= merge.e.r && col >= merge.s.c && col <= merge.e.c) {
          // This cell is part of a merge, return the top-left cell value
          return rawData[merge.s.r]?.[merge.s.c]
        }
      }
      // Not merged, return the cell's own value
      return rawData[row]?.[col]
    }

    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    if (rawData.length < 4) {
      return NextResponse.json({ error: 'Fichier vide ou format invalide' }, { status: 400 })
    }

    // Parse headers
    const weekHeaders = rawData[1] as string[] // Week names
    const dayHeaders = rawData[2] as string[] // Day names (lu 18, ma 19, etc.)

    // Determine year from title
    const title = String(rawData[0]?.[0] || '')
    const yearMatch = title.match(/(\d{2})-(\d{2})/)
    const startYear = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : new Date().getFullYear()

    // Build column-to-date mapping
    const columnDates: Map<number, string> = new Map()
    let currentWeekHeader = ''

    for (let col = 2; col < dayHeaders.length; col++) {
      // Update week header if this column has one
      if (weekHeaders[col] && String(weekHeaders[col]).trim()) {
        currentWeekHeader = String(weekHeaders[col])
      }

      const dayHeader = String(dayHeaders[col] || '').trim()
      if (dayHeader && currentWeekHeader) {
        const date = parseDateFromHeader(dayHeader, currentWeekHeader, startYear)
        if (date) {
          columnDates.set(col, date)
        }
      }
    }

    // Parse remplaçants (each takes 2 rows)
    const parsedRemplacants: ParsedRemplacant[] = []

    for (let row = 3; row < rawData.length; row += 2) {
      const matinRow = rawData[row] as unknown[]
      const apremRow = rawData[row + 1] as unknown[] | undefined

      const name = String(matinRow[0] || '').trim()
      if (!name) continue // Skip empty rows

      const remarques = String(matinRow[1] || '').trim() || null
      const disponibilites: ParsedDisponibilite[] = []

      // Process each date column
      for (const [col, date] of columnDates) {
        // Morning (matin) - use getMergedValue to handle merged cells
        const matinRowIndex = row // row is the index of the matin row in rawData
        const matinValue = getMergedValue(matinRowIndex, col, rawData)
        let matinParsed = parseCellValue(matinValue)

        // Afternoon (après-midi) - use getMergedValue to handle merged cells
        let apremParsed = null
        if (apremRow) {
          const apremRowIndex = row + 1
          const apremValue = getMergedValue(apremRowIndex, col, rawData)
          apremParsed = parseCellValue(apremValue)
        }

        // Handle merged cells or data entry patterns:
        // 1. If one row is empty but the other has a value, copy the value
        // 2. If matin has an assignment (note) and après-midi is just "libre",
        //    assume the assignment applies to both (common pattern for full-day assignments)
        if (matinParsed === null && apremParsed !== null) {
          matinParsed = apremParsed
        } else if (apremParsed === null && matinParsed !== null) {
          apremParsed = matinParsed
        } else if (matinParsed?.note && apremParsed?.isAvailable && !apremParsed?.note) {
          // Matin has assignment, après-midi is just "libre" → copy assignment to après-midi
          apremParsed = matinParsed
        } else if (apremParsed?.note && matinParsed?.isAvailable && !matinParsed?.note) {
          // Après-midi has assignment, matin is just "libre" → copy assignment to matin
          matinParsed = apremParsed
        }

        if (matinParsed !== null) {
          disponibilites.push({
            remplacantName: name,
            date,
            creneau: 'matin',
            isAvailable: matinParsed.isAvailable,
            note: matinParsed.note,
          })
        }

        if (apremParsed !== null) {
          disponibilites.push({
            remplacantName: name,
            date,
            creneau: 'apres_midi',
            isAvailable: apremParsed.isAvailable,
            note: apremParsed.note,
          })
        }
      }

      parsedRemplacants.push({ name, remarques, disponibilites })
    }

    // Get all remplaçants from DB for matching
    const dbRemplacants = await db
      .select({ id: remplacants.id, lastName: remplacants.lastName, firstName: remplacants.firstName })
      .from(remplacants)

    // Get all collaborateurs from DB for matching
    const dbCollaborateurs = await db
      .select({ id: collaborateurs.id, lastName: collaborateurs.lastName, firstName: collaborateurs.firstName })
      .from(collaborateurs)

    // Get all écoles from DB for affectation matching
    const dbEcoles = await db
      .select({ id: ecoles.id, name: ecoles.name })
      .from(ecoles)

    // Match école name to DB (flexible matching)
    const matchEcole = (name: string): number | null => {
      const cleanName = name.toLowerCase().trim()
      for (const e of dbEcoles) {
        const ecoleName = e.name.toLowerCase()
        // Exact match
        if (ecoleName === cleanName) return e.id
        // One contains the other
        if (ecoleName.includes(cleanName) || cleanName.includes(ecoleName)) return e.id
        // École starts with search term or vice versa (for "Bachets" vs "Bachet-de-Pesay")
        if (ecoleName.startsWith(cleanName) || cleanName.startsWith(ecoleName.split('-')[0])) return e.id
        // Check each part of hyphenated name
        const parts = ecoleName.split('-')
        for (const part of parts) {
          if (part.startsWith(cleanName) || cleanName.startsWith(part)) return e.id
        }
      }
      return null
    }

    // Match collaborateur by first name (flexible matching for "Charlène" vs "Lys-Charlène")
    const matchCollaborateurByFirstName = (firstName: string): number | null => {
      const cleanName = firstName.toLowerCase().trim()
      for (const c of dbCollaborateurs) {
        const firstNameDb = c.firstName.toLowerCase()
        // Exact match
        if (firstNameDb === cleanName) return c.id
        // One contains the other (for "Charlène" in "Lys-Charlène")
        if (firstNameDb.includes(cleanName) || cleanName.includes(firstNameDb)) return c.id
        // Check hyphenated first names
        const parts = firstNameDb.split('-')
        for (const part of parts) {
          if (part === cleanName || part.includes(cleanName) || cleanName.includes(part)) return c.id
        }
      }
      return null
    }

    // Match parsed names to DB records - first try remplaçants, then collaborateurs
    const matchPerson = (name: string): { id: number; type: 'remplacant' | 'collaborateur' } | null => {
      const cleanName = name.replace(/\r?\n/g, ' ').trim().toLowerCase()

      // Try remplaçants first
      for (const r of dbRemplacants) {
        const fullName1 = `${r.firstName} ${r.lastName}`.toLowerCase()
        const fullName2 = `${r.lastName} ${r.firstName}`.toLowerCase()
        const lastNameOnly = r.lastName.toLowerCase()

        if (cleanName.includes(fullName1) || cleanName.includes(fullName2) ||
            fullName1.includes(cleanName) || fullName2.includes(cleanName) ||
            cleanName.startsWith(lastNameOnly) || cleanName.includes(lastNameOnly)) {
          return { id: r.id, type: 'remplacant' }
        }
      }

      // Then try collaborateurs
      for (const c of dbCollaborateurs) {
        const fullName1 = `${c.firstName} ${c.lastName}`.toLowerCase()
        const fullName2 = `${c.lastName} ${c.firstName}`.toLowerCase()
        const lastNameOnly = c.lastName.toLowerCase()

        if (cleanName.includes(fullName1) || cleanName.includes(fullName2) ||
            fullName1.includes(cleanName) || fullName2.includes(cleanName) ||
            cleanName.startsWith(lastNameOnly) || cleanName.includes(lastNameOnly)) {
          return { id: c.id, type: 'collaborateur' }
        }
      }

      return null
    }

    if (isPreview) {
      // Generate preview
      const preview: PreviewRow[] = parsedRemplacants.map((r, idx) => {
        const match = matchPerson(r.name)
        const libres = r.disponibilites.filter(d => d.isAvailable).length
        const pasDispo = r.disponibilites.filter(d => !d.isAvailable && !d.note).length
        const affectations = r.disponibilites.filter(d => !d.isAvailable && d.note).length

        let error: string | undefined
        if (!match) {
          error = 'Personne non trouvée dans la base'
        } else if (match.type === 'collaborateur') {
          error = 'Collaborateur (disponibilités non importées)'
        }

        // Debug: include detailed disponibilités with affectation parsing info
        const details = r.disponibilites.map(d => {
          let affectationParsed: ParsedAffectationDebug | null = null

          if (d.note) {
            const parsed = parseAffectationNote(d.note)
            if (parsed) {
              const ecoleId = matchEcole(parsed.ecoleName)
              const personId = parsed.personName ? matchCollaborateurByFirstName(parsed.personName) : null
              affectationParsed = {
                ecoleName: parsed.ecoleName,
                personName: parsed.personName,
                ecoleFound: ecoleId !== null,
                ecoleId,
                personFound: parsed.personName ? personId !== null : false,
                personId,
              }
            }
          }

          return {
            date: d.date,
            creneau: d.creneau,
            isAvailable: d.isAvailable,
            note: d.note,
            affectationParsed,
          }
        })

        return {
          row: (idx * 2) + 4, // Excel row number
          name: r.name.replace(/\r?\n/g, ' '),
          remarques: r.remarques,
          disponibilitesCount: r.disponibilites.length,
          libres,
          pasDispo,
          affectations,
          matched: !!match,
          matchedId: match?.id,
          matchedType: match?.type,
          error,
          details,
        }
      })

      const matchedRemplacants = preview.filter(p => p.matchedType === 'remplacant').length
      const matchedCollaborateurs = preview.filter(p => p.matchedType === 'collaborateur').length
      const unmatched = preview.filter(p => !p.matched).length
      const totalDispo = parsedRemplacants.reduce((sum, r) => sum + r.disponibilites.length, 0)

      // Debug: list all detected dates with their column indices
      const detectedDates = [...columnDates.entries()].map(([col, date]) => ({
        col,
        date,
        dayHeader: String(dayHeaders[col] || ''),
      }))

      return NextResponse.json({
        preview,
        total: parsedRemplacants.length,
        matched: matchedRemplacants,
        matchedCollaborateurs,
        unmatched,
        totalDisponibilites: totalDispo,
        sheetName,
        dateRange: {
          start: [...columnDates.values()].sort()[0],
          end: [...columnDates.values()].sort().pop(),
        },
        datesCount: columnDates.size,
        detectedDates, // Debug info
      })
    }

    // Actual import
    let imported = 0
    let updated = 0
    let affectationsCreated = 0
    let remarquesUpdated = 0
    let skippedNotFound = 0
    let skippedCollaborateurs = 0
    const errors: Array<{ name: string; message: string }> = []

    for (const r of parsedRemplacants) {
      const match = matchPerson(r.name)

      if (!match) {
        skippedNotFound++
        errors.push({ name: r.name, message: 'Personne non trouvée' })
        continue
      }

      if (match.type === 'collaborateur') {
        skippedCollaborateurs++
        // Not an error, just skipped because it's a collaborateur
        continue
      }

      // Add remarque if present
      if (r.remarques) {
        await db
          .insert(remplacantRemarques)
          .values({
            remplacantId: match.id,
            content: r.remarques,
            createdBy: user.id,
          })
        remarquesUpdated++
      }

      // Import "libre" disponibilités AND entries with notes (affectations like "Cointrin pour Lucie")
      // Skip plain "pas dispo" entries (no note) since unavailability is the default
      const toImport = r.disponibilites.filter(d => d.isAvailable || d.note)

      for (const d of toImport) {
        try {
          // Check if this is an affectation (has note with école and person)
          if (d.note) {
            const parsed = parseAffectationNote(d.note)
            if (parsed) {
              const ecoleId = matchEcole(parsed.ecoleName)
              const collaborateurId = parsed.personName ? matchCollaborateurByFirstName(parsed.personName) : null

              if (ecoleId && collaborateurId) {
                // Create affectation
                await db
                  .insert(remplacantAffectations)
                  .values({
                    remplacantId: match.id,
                    collaborateurId,
                    ecoleId,
                    dateDebut: d.date,
                    dateFin: d.date,
                    creneau: d.creneau,
                    motif: d.note,
                    isActive: true,
                    createdBy: user.id,
                    updatedBy: user.id,
                  })
                affectationsCreated++
                continue // Skip disponibilité creation
              }
            }
          }

          // If not an affectation or couldn't match, create disponibilité
          await db
            .insert(remplacantDisponibilitesSpecifiques)
            .values({
              remplacantId: match.id,
              date: d.date,
              creneau: d.creneau,
              isAvailable: d.isAvailable,
              note: d.note,
              createdBy: user.id,
              updatedBy: user.id,
            })
            .onConflictDoUpdate({
              target: [
                remplacantDisponibilitesSpecifiques.remplacantId,
                remplacantDisponibilitesSpecifiques.date,
                remplacantDisponibilitesSpecifiques.creneau,
              ],
              set: {
                isAvailable: d.isAvailable,
                note: d.note,
                updatedBy: user.id,
                updatedAt: new Date(),
              },
            })

          imported++
        } catch (error) {
          console.error('Error inserting disponibilite:', error)
          updated++ // Assume it was an update if insert failed
        }
      }
    }

    return NextResponse.json({
      imported,
      updated,
      affectationsCreated,
      remarquesUpdated,
      skippedNotFound,
      skippedCollaborateurs,
      errors,
    })
  } catch (error) {
    console.error('Error importing disponibilites:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
