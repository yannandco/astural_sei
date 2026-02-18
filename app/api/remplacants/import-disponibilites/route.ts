import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { remplacants, remplacantDisponibilitesSpecifiques, remplacantRemarques, remplacantAffectations, collaborateurs, ecoles, absences, collaborateurEcoles } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'
import { eq, and, ilike, sql } from 'drizzle-orm'
import type { Creneau } from '@/components/planning'

// Strip accents for flexible matching (e.g., "Crets" matches "Crêts", "Paquis" matches "Pâquis")
function normalizeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Flexible name matching for abbreviated forms:
// "charlèneK" → matches "Lys-Charlène KASSI ROBERT" (firstName part + lastNameInitial, no space)
// "Luis DC" → matches "Luis DA COSTA" (firstName + initials of last name)
function flexibleNameMatch(input: string, dbFirstName: string, dbLastName: string): boolean {
  const cleanFirst = normalizeAccents(dbFirstName.toLowerCase())
  const cleanLast = normalizeAccents(dbLastName.toLowerCase())
  const firstParts = cleanFirst.split('-')

  // Pattern 1: "firstNamePartLastInitial" concatenated (e.g., "charlèneK")
  // Detect: ends with 1-2 uppercase letters glued to a lowercase name
  const concatMatch = input.trim().match(/^(.+?)([A-Z]{1,3})$/)
  if (concatMatch) {
    const inputFirst = normalizeAccents(concatMatch[1].toLowerCase())
    const inputInitials = concatMatch[2].toUpperCase()
    // Check first part matches any part of first name
    const firstMatches = firstParts.some(p => p === inputFirst || p.includes(inputFirst) || inputFirst.includes(p))
    if (firstMatches) {
      // Check initials match start of last name words
      const lastWords = dbLastName.split(/[\s-]+/).filter(w => w.length > 0)
      const lastInitials = lastWords.map(w => w[0].toUpperCase()).join('')
      if (lastInitials.startsWith(inputInitials) || inputInitials === lastWords[0]?.[0]?.toUpperCase()) return true
    }
  }

  // Pattern 2: "FirstName INITIALS" with space (e.g., "Luis DC")
  const parts = input.trim().split(/\s+/)
  if (parts.length === 2 && /^[A-Z]{2,4}$/.test(parts[1])) {
    const inputFirst = normalizeAccents(parts[0].toLowerCase())
    const inputInitials = parts[1]
    const firstMatches = cleanFirst === inputFirst || firstParts.some(p => p === inputFirst || p.includes(inputFirst) || inputFirst.includes(p))
    if (firstMatches) {
      const lastWords = dbLastName.split(/[\s-]+/).filter(w => w.length > 0)
      const lastInitials = lastWords.map(w => w[0].toUpperCase()).join('')
      if (lastInitials === inputInitials) return true
    }
  }

  return false
}

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

  // Pattern 1b: "Rempl. [École] par [Personne]" (e.g., "Rempl. Corsier par Kasandra")
  const patternPar = /^(?:Remplacement|Rempl\.?)\s+(.+?)\s+par\s+(.+)$/i
  const matchPar = note.match(patternPar)
  if (matchPar) {
    return {
      ecoleName: matchPar[1].trim(),
      personName: matchPar[2].trim(),
    }
  }

  // Pattern 1c: "Nème Obs [Personne] [École]" (e.g., "1ère Obs Lysiane Petit-Lancy", "2ème Obs Marie Cointrin")
  const patternObs = /^(?:\d+[eè](?:re|me|ème)\s+)?Obs\.?\s+(\S+)\s+(.+)$/i
  const matchObs = note.match(patternObs)
  if (matchObs) {
    return {
      personName: matchObs[1].trim(),
      ecoleName: matchObs[2].trim(),
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

  // Pattern 2b: "Rempl. [École]" - just école, no person (e.g., "Rempl. Contamines")
  const patternRemplacementEcole = /^(?:Remplacement|Rempl\.?)\s+(.+)$/i
  const matchRemplacementEcole = note.match(patternRemplacementEcole)
  if (matchRemplacementEcole) {
    return {
      ecoleName: matchRemplacementEcole[1].trim(),
      personName: null,
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
  const skipValues = ['libre', 'pas dispo', 'pas disponible', 'vacances', 'congé', 'maladie', 'malade', 'formation']
  const cleanNote = note.trim().toLowerCase()
  if (!skipValues.some(v => cleanNote.includes(v))) {
    return {
      ecoleName: note.trim(),
      personName: null,
    }
  }

  return null
}

// Parse format2 cell: "École Remplaçant", "Remplaçant", or "Rempl. École par Remplaçant"
// Returns école name and remplaçant name
function parseFormat2Cell(value: string): { ecoleName: string | null; remplacantName: string | null } {
  const val = value.trim()
  if (!val) return { ecoleName: null, remplacantName: null }

  // Pattern: "Rempl. [École] par [Remplaçant]"
  const patternPar = /^(?:Remplacement|Rempl\.?)\s+(.+?)\s+par\s+(.+)$/i
  const matchPar = val.match(patternPar)
  if (matchPar) {
    return { ecoleName: matchPar[1].trim(), remplacantName: matchPar[2].trim() }
  }

  // Pattern: "[École] pour [Remplaçant]" or "Rempl. [École] pour [Remplaçant]"
  const patternPour = /^(?:Rempl\.?\s*)?(.+?)\s+pour\s+(.+)$/i
  const matchPour = val.match(patternPour)
  if (matchPour) {
    return { ecoleName: matchPour[1].trim(), remplacantName: matchPour[2].trim() }
  }

  // Two words: first = école, second = remplaçant name (e.g., "Le-Corbusier Kasandra")
  // But careful: "Le Corbusier" is 2 words that form an école name...
  // Heuristic: if there are exactly 2 words, treat as "école remplaçant"
  const words = val.split(/\s+/)
  if (words.length === 2) {
    return { ecoleName: words[0], remplacantName: words[1] }
  }

  // Three+ words: try "école_part1 école_part2 ... remplaçant" — last word is person
  if (words.length >= 3) {
    return { ecoleName: words.slice(0, -1).join(' '), remplacantName: words[words.length - 1] }
  }

  // Single word: likely just the remplaçant name
  return { ecoleName: null, remplacantName: val }
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
  personType?: 'collaborateur' | 'remplacant'
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

  // Malade = absent/unavailable
  if (str === 'malade') {
    return { isAvailable: false, note: 'malade' }
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
    const format = searchParams.get('format') || 'format1'
    const monthParam = searchParams.get('month') // 0-11, only for format2

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

    // Row/column offsets based on format
    // format1: title=0, weeks=1, days=2, data=3, remarques=col1, dates start col2
    // format2: title=0, weeks=2, days=3, data=4, no remarques, dates start col1
    const rowOffset = format === 'format2' ? 1 : 0
    const titleRow = 0
    const weekRow = 1 + rowOffset
    const dayRow = 2 + rowOffset
    const dataStartRow = 3 + rowOffset
    const dateStartCol = format === 'format2' ? 1 : 2
    const hasRemarquesCol = format !== 'format2'

    if (rawData.length < dataStartRow + 1) {
      return NextResponse.json({ error: 'Fichier vide ou format invalide' }, { status: 400 })
    }

    // Parse headers
    const weekHeaders = rawData[weekRow] as string[] // Week names
    const dayHeaders = rawData[dayRow] as string[] // Day names (lu 18, ma 19, etc.)

    // Determine year from title
    const title = String(rawData[titleRow]?.[0] || '')
    const yearMatch = title.match(/(\d{2})-(\d{2})/)
    const startYear = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : new Date().getFullYear()

    // Build column-to-date mapping (only dates >= January 2026)
    const columnDates: Map<number, string> = new Map()
    let currentWeekHeader = ''
    const MIN_DATE = '2026-01-01'

    for (let col = dateStartCol; col < dayHeaders.length; col++) {
      // Update week header if this column has one
      if (weekHeaders[col] && String(weekHeaders[col]).trim()) {
        currentWeekHeader = String(weekHeaders[col])
      }

      const dayHeader = String(dayHeaders[col] || '').trim()
      if (dayHeader && currentWeekHeader) {
        const date = parseDateFromHeader(dayHeader, currentWeekHeader, startYear)
        if (date && date >= MIN_DATE) {
          columnDates.set(col, date)
        }
      }
    }

    // ═══ Format 2: Collaborateur rows → affectations ═══
    // Structure: Row 4 = day names (lundi, mardi, ...), Row 5 = day numbers (5, 6, 7, ...)
    // Row 6+ = 1 row per collaborateur, cells = "École Remplaçant" or just remplaçant name
    if (format === 'format2') {
      // Rebuild columnDates for Format 2 (completely different header structure)
      columnDates.clear()

      // Format 2 header rows:
      // Row 4 (index 4): day names repeating per week (lundi, mardi, me, jeudi, vendredi, sa, di)
      // Row 5 (index 5): day numbers (5, 6, 7, 8, 9, 10, 11, ...)
      const f2DayNameRow = 4
      const f2DayNumberRow = 5
      const f2DataStartRow = 6
      const f2DateStartCol = 1

      const f2DayNames = rawData[f2DayNameRow] as unknown[] || []
      const f2DayNumbers = rawData[f2DayNumberRow] as unknown[] || []

      // Detect month from title, headers (rows 0-3), or sheet name
      const f2MonthPatterns = [
        { pattern: /janv/i, month: 0 },
        { pattern: /f[eé]vr/i, month: 1 },
        { pattern: /mars/i, month: 2 },
        { pattern: /avr/i, month: 3 },
        { pattern: /mai/i, month: 4 },
        { pattern: /juin/i, month: 5 },
        { pattern: /juil/i, month: 6 },
        { pattern: /ao[uû]t/i, month: 7 },
        { pattern: /sep/i, month: 8 },
        { pattern: /oct/i, month: 9 },
        { pattern: /nov/i, month: 10 },
        { pattern: /d[eé]c/i, month: 11 },
      ]

      let f2Month = -1
      // Use manual month if provided
      if (monthParam !== null && monthParam !== '') {
        f2Month = parseInt(monthParam, 10)
      }
      // Otherwise auto-detect from rows 0-3
      if (f2Month === -1) {
        for (let r = 0; r < Math.min(f2DayNameRow, rawData.length); r++) {
          const rowText = (rawData[r] as unknown[] || []).map(c => String(c ?? '')).join(' ')
          for (const { pattern, month: m } of f2MonthPatterns) {
            if (pattern.test(rowText)) { f2Month = m; break }
          }
          if (f2Month >= 0) break
        }
      }
      // Also try sheet name
      if (f2Month === -1) {
        for (const { pattern, month: m } of f2MonthPatterns) {
          if (pattern.test(sheetName)) { f2Month = m; break }
        }
      }

      // School year: Aug-Dec = startYear, Jan-Jul = startYear+1
      const f2Year = f2Month >= 0 && f2Month < 7 ? startYear + 1 : startYear

      // Build dates from day numbers
      let prevDay = 0
      let currentMonth = f2Month >= 0 ? f2Month : 0

      for (let col = f2DateStartCol; col < f2DayNumbers.length; col++) {
        const num = parseInt(String(f2DayNumbers[col] ?? ''))
        if (isNaN(num) || num <= 0 || num > 31) continue

        // Detect month wrap (e.g., 30, 31, 1, 2 → next month)
        if (num < prevDay && prevDay > 20) currentMonth++
        prevDay = num

        // Skip weekends
        const dayName = String(f2DayNames[col] ?? '').toLowerCase().trim()
        if (['sa', 'di', 'samedi', 'dimanche'].includes(dayName)) continue

        const actualYear = currentMonth > 11 ? f2Year + 1 : f2Year
        const actualMonth = currentMonth % 12
        const mm = (actualMonth + 1).toString().padStart(2, '0')
        const dd = num.toString().padStart(2, '0')
        columnDates.set(col, `${actualYear}-${mm}-${dd}`)
      }

      interface ParsedCollabRow {
        name: string
        row: number
        cells: Array<{
          date: string
          creneau: Creneau
          rawValue: string
          ecoleName: string | null
          remplacantName: string | null
        }>
      }

      const parsedCollabRows: ParsedCollabRow[] = []

      // 1 row per collaborateur (journée)
      for (let row = f2DataStartRow; row < rawData.length; row++) {
        const dataRow = rawData[row] as unknown[]
        if (!dataRow) continue

        const name = String(dataRow[0] || '').trim()
        if (!name) continue

        const cells: ParsedCollabRow['cells'] = []

        for (const [col, date] of columnDates) {
          const cellValue = getMergedValue(row, col, rawData)
          const val = String(cellValue ?? '').trim()
          if (!val) continue

          const lower = val.toLowerCase()
          if (lower === 'libre' || lower === 'vacances' || lower === 'noël' || lower === 'noel') continue

          const parsed = parseFormat2Cell(val)
          cells.push({ date, creneau: 'journee', rawValue: val, ...parsed })
        }

        parsedCollabRows.push({ name, row, cells })
      }

      // Get DB data for matching
      const dbRemplacants = await db
        .select({ id: remplacants.id, lastName: remplacants.lastName, firstName: remplacants.firstName })
        .from(remplacants)

      const dbCollaborateurs = await db
        .select({ id: collaborateurs.id, lastName: collaborateurs.lastName, firstName: collaborateurs.firstName })
        .from(collaborateurs)

      const dbEcoles = await db
        .select({ id: ecoles.id, name: ecoles.name })
        .from(ecoles)

      const dbCollabEcoles = await db
        .select({ collaborateurId: collaborateurEcoles.collaborateurId, ecoleId: collaborateurEcoles.ecoleId })
        .from(collaborateurEcoles)
        .where(eq(collaborateurEcoles.isActive, true))

      const collabEcoleMap = new Map<number, number>()
      for (const ce of dbCollabEcoles) {
        if (!collabEcoleMap.has(ce.collaborateurId)) {
          collabEcoleMap.set(ce.collaborateurId, ce.ecoleId)
        }
      }

      // Matching helpers (same as format1, inline for scope)
      const matchCollabByName = (name: string): number | null => {
        const clean = normalizeAccents(name.replace(/\r?\n/g, ' ').trim().toLowerCase())
        for (const c of dbCollaborateurs) {
          const fn = normalizeAccents(c.firstName.toLowerCase())
          const ln = normalizeAccents(c.lastName.toLowerCase())
          const full1 = `${fn} ${ln}`
          const full2 = `${ln} ${fn}`
          if (clean === full1 || clean === full2 || clean === fn || clean === ln) return c.id
          if (full1.includes(clean) || full2.includes(clean) || clean.includes(full1) || clean.includes(full2)) return c.id
          if (clean.includes(ln) || ln.includes(clean)) return c.id
          // Flexible matching: "charlèneK" → "Lys-Charlène KASSI ROBERT", "Luis DC" → "Luis DA COSTA"
          if (flexibleNameMatch(name, c.firstName, c.lastName)) return c.id
        }
        return null
      }

      const matchRemplacantByName = (name: string): number | null => {
        const clean = normalizeAccents(name.trim().toLowerCase())
        for (const r of dbRemplacants) {
          const fn = normalizeAccents(r.firstName.toLowerCase())
          const ln = normalizeAccents(r.lastName.toLowerCase())
          if (clean === fn || clean === ln || clean === `${fn} ${ln}` || clean === `${ln} ${fn}`) return r.id
          if (fn.includes(clean) || clean.includes(fn)) return r.id
          // Hyphenated first names
          for (const part of fn.split('-')) {
            if (part === clean || part.includes(clean) || clean.includes(part)) return r.id
          }
          // Flexible matching: "charlèneK" → "Lys-Charlène KASSI ROBERT", "Luis DC" → "Luis DA COSTA"
          if (flexibleNameMatch(name, r.firstName, r.lastName)) return r.id
        }
        return null
      }

      const normalizeHyphens = (str: string): string => str.replace(/[-\s]+/g, ' ').trim()
      const getInitials = (name: string): string => {
        const skip = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'dans', 'en', 'au', 'aux', 'a', 'l'])
        return name.replace(/['-]/g, ' ').split(/\s+/).filter(w => w.length > 0 && !skip.has(w.toLowerCase())).map(w => w[0].toUpperCase()).join('')
      }
      const matchEcoleF2 = (name: string): number | null => {
        const cleanName = normalizeAccents(name.toLowerCase().trim())
        const cleanNameNorm = normalizeHyphens(cleanName)
        for (const e of dbEcoles) {
          const en = normalizeAccents(e.name.toLowerCase())
          const enNorm = normalizeHyphens(en)
          if (en === cleanName || enNorm === cleanNameNorm) return e.id
          if (en.includes(cleanName) || cleanName.includes(en)) return e.id
          if (enNorm.includes(cleanNameNorm) || cleanNameNorm.includes(enNorm)) return e.id
          if (en.startsWith(cleanName) || cleanName.startsWith(en.split('-')[0])) return e.id
          for (const part of en.split('-')) {
            if (part.startsWith(cleanName) || cleanName.startsWith(part)) return e.id
          }
          const orig = name.trim()
          if (orig.length >= 2 && /^[A-Z]+$/.test(orig)) {
            if (getInitials(normalizeAccents(e.name)) === orig) return e.id
          }
        }
        return null
      }

      if (isPreview) {
        const preview: PreviewRow[] = parsedCollabRows.map((r, idx) => {
          const collabId = matchCollabByName(r.name)

          const details = r.cells.map(cell => {
            let ecoleId = cell.ecoleName ? matchEcoleF2(cell.ecoleName) : null
            const remplacantId = cell.remplacantName ? matchRemplacantByName(cell.remplacantName) : null

            // If no école from cell, use collaborateur's école
            if (!ecoleId && collabId) {
              ecoleId = collabEcoleMap.get(collabId) ?? null
            }

            return {
              date: cell.date,
              creneau: cell.creneau,
              isAvailable: false,
              note: cell.rawValue,
              affectationParsed: {
                ecoleName: cell.ecoleName || (ecoleId ? dbEcoles.find(e => e.id === ecoleId)?.name ?? '' : ''),
                personName: cell.remplacantName,
                ecoleFound: ecoleId !== null,
                ecoleId,
                personFound: remplacantId !== null,
                personId: remplacantId,
                personType: 'remplacant' as const,
              } satisfies ParsedAffectationDebug,
            }
          })

          return {
            row: r.row + 1,
            name: r.name.replace(/\r?\n/g, ' '),
            remarques: null,
            disponibilitesCount: r.cells.length,
            libres: 0,
            pasDispo: 0,
            affectations: r.cells.length,
            matched: collabId !== null,
            matchedId: collabId ?? undefined,
            matchedType: 'collaborateur' as const,
            error: !collabId ? 'Collaborateur non trouvé dans la base' : undefined,
            details,
          }
        })

        const matched = preview.filter(p => p.matched).length
        const unmatched = preview.filter(p => !p.matched).length
        const totalCells = parsedCollabRows.reduce((sum, r) => sum + r.cells.length, 0)

        const detectedDates = [...columnDates.entries()].map(([col, date]) => ({
          col, date, dayHeader: String(dayHeaders[col] || ''),
        }))

        // Debug: show raw file structure
        const f2MonthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
        const debugInfo = {
          titleRow: { row: titleRow, value: String(rawData[titleRow]?.[0] || '') },
          weekRow: { row: f2DayNameRow, values: f2DayNames.slice(0, 10).map(v => String(v ?? '')) },
          dayRow: { row: f2DayNumberRow, values: (f2DayNumbers as unknown[]).slice(0, 10).map(v => String(v ?? '')) },
          dataStartRow: f2DataStartRow,
          dateStartCol: f2DateStartCol,
          startYear: f2Year,
          totalRows: rawData.length,
          detectedMonth: f2Month >= 0 ? f2MonthNames[f2Month] : 'NON DÉTECTÉ',
          firstDataRow: rawData[f2DataStartRow]
            ? (rawData[f2DataStartRow] as unknown[]).slice(0, 10).map(v => String(v ?? ''))
            : [],
          secondDataRow: rawData[f2DataStartRow + 1]
            ? (rawData[f2DataStartRow + 1] as unknown[]).slice(0, 10).map(v => String(v ?? ''))
            : [],
        }

        return NextResponse.json({
          preview,
          total: parsedCollabRows.length,
          matched,
          matchedCollaborateurs: matched,
          unmatched,
          totalDisponibilites: totalCells,
          sheetName,
          dateRange: {
            start: [...columnDates.values()].sort()[0],
            end: [...columnDates.values()].sort().pop(),
          },
          datesCount: columnDates.size,
          detectedDates,
          debugInfo,
        })
      }

      // Actual import for format2
      let affectationsCreated = 0
      let skippedNotFound = 0
      const errors: Array<{ name: string; message: string }> = []

      for (const r of parsedCollabRows) {
        const collabId = matchCollabByName(r.name)
        if (!collabId) {
          skippedNotFound++
          errors.push({ name: r.name, message: 'Collaborateur non trouvé' })
          continue
        }

        for (const cell of r.cells) {
          try {
            let ecoleId = cell.ecoleName ? matchEcoleF2(cell.ecoleName) : null
            const remplacantId = cell.remplacantName ? matchRemplacantByName(cell.remplacantName) : null

            // Fallback: use collaborateur's école
            if (!ecoleId) {
              ecoleId = collabEcoleMap.get(collabId) ?? null
            }

            if (remplacantId && ecoleId) {
              await db
                .insert(remplacantAffectations)
                .values({
                  remplacantId,
                  collaborateurId: collabId,
                  ecoleId,
                  dateDebut: cell.date,
                  dateFin: cell.date,
                  creneau: cell.creneau,
                  motif: cell.rawValue,
                  isActive: true,
                  createdBy: user.id,
                  updatedBy: user.id,
                })
              affectationsCreated++
            } else {
              errors.push({ name: r.name, message: `Non résolu: ${cell.rawValue} (${cell.date})` })
            }
          } catch (error) {
            console.error('Error creating affectation:', error)
            errors.push({ name: r.name, message: `Erreur: ${cell.rawValue}` })
          }
        }
      }

      return NextResponse.json({
        imported: 0,
        updated: 0,
        affectationsCreated,
        absencesCreated: 0,
        remarquesUpdated: 0,
        skippedNotFound,
        skippedCollaborateurs: 0,
        errors,
      })
    }

    // ═══ Format 1: Remplaçant rows → disponibilités + affectations ═══
    // Parse remplaçants (each takes 2 rows)
    const parsedRemplacants: ParsedRemplacant[] = []

    for (let row = dataStartRow; row < rawData.length; row += 2) {
      const matinRow = rawData[row] as unknown[]
      const apremRow = rawData[row + 1] as unknown[] | undefined

      const name = String(matinRow[0] || '').trim()
      if (!name) continue // Skip empty rows

      const remarques = hasRemarquesCol ? (String(matinRow[1] || '').trim() || null) : null
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

    // Get collaborateur→école mapping (to resolve "Nadine" → collaborateur Nadine → her école)
    const dbCollabEcoles = await db
      .select({ collaborateurId: collaborateurEcoles.collaborateurId, ecoleId: collaborateurEcoles.ecoleId })
      .from(collaborateurEcoles)
      .where(eq(collaborateurEcoles.isActive, true))

    // Build a map: collaborateurId → first ecoleId
    const collabEcoleMap = new Map<number, number>()
    for (const ce of dbCollabEcoles) {
      if (!collabEcoleMap.has(ce.collaborateurId)) {
        collabEcoleMap.set(ce.collaborateurId, ce.ecoleId)
      }
    }

    // Normalize hyphens and spaces for flexible matching (Le Corbusier = Le-Corbusier)
    const normalizeHyphens = (str: string): string => str.replace(/[-\s]+/g, ' ').trim()

    // Build initials from école name (e.g., "Petits Pas dans les Bois" → "PPB")
    // Skip common articles/prepositions: de, des, du, la, le, les, dans, en, au, aux, à, l'
    const getInitials = (name: string): string => {
      const skip = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'dans', 'en', 'au', 'aux', 'a', 'l'])
      return name
        .replace(/['-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0 && !skip.has(w.toLowerCase()))
        .map(w => w[0].toUpperCase())
        .join('')
    }

    // Match école name to DB (flexible matching, accent-insensitive, hyphen/space-insensitive, initials)
    const matchEcole = (name: string): number | null => {
      const cleanName = normalizeAccents(name.toLowerCase().trim())
      const cleanNameNorm = normalizeHyphens(cleanName)
      for (const e of dbEcoles) {
        const ecoleName = normalizeAccents(e.name.toLowerCase())
        const ecoleNameNorm = normalizeHyphens(ecoleName)
        // Exact match
        if (ecoleName === cleanName) return e.id
        // Exact match after hyphen/space normalization (Le Corbusier = Le-Corbusier)
        if (ecoleNameNorm === cleanNameNorm) return e.id
        // One contains the other
        if (ecoleName.includes(cleanName) || cleanName.includes(ecoleName)) return e.id
        // Same with normalized hyphens
        if (ecoleNameNorm.includes(cleanNameNorm) || cleanNameNorm.includes(ecoleNameNorm)) return e.id
        // École starts with search term or vice versa (for "Bachets" vs "Bachet-de-Pesay")
        if (ecoleName.startsWith(cleanName) || cleanName.startsWith(ecoleName.split('-')[0])) return e.id
        // Check each part of hyphenated name
        const parts = ecoleName.split('-')
        for (const part of parts) {
          if (part.startsWith(cleanName) || cleanName.startsWith(part)) return e.id
        }
        // Initials matching (PPB → Petits Pas dans les Bois)
        const originalTrimmed = name.trim()
        if (originalTrimmed.length >= 2 && /^[A-Z]+$/.test(originalTrimmed)) {
          const ecoleInitials = getInitials(normalizeAccents(e.name))
          if (ecoleInitials === originalTrimmed) return e.id
        }
      }
      return null
    }

    // Match collaborateur by first name (flexible matching, accent-insensitive)
    const matchCollaborateurByFirstName = (firstName: string): number | null => {
      const cleanName = normalizeAccents(firstName.toLowerCase().trim())
      for (const c of dbCollaborateurs) {
        const firstNameDb = normalizeAccents(c.firstName.toLowerCase())
        // Exact match
        if (firstNameDb === cleanName) return c.id
        // One contains the other (for "Charlène" in "Lys-Charlène")
        if (firstNameDb.includes(cleanName) || cleanName.includes(firstNameDb)) return c.id
        // Check hyphenated first names
        const parts = firstNameDb.split('-')
        for (const part of parts) {
          if (part === cleanName || part.includes(cleanName) || cleanName.includes(part)) return c.id
        }
        // Flexible matching: "charlèneK" → "Lys-Charlène KASSI ROBERT", "Luis DC" → "Luis DA COSTA"
        if (flexibleNameMatch(firstName, c.firstName, c.lastName)) return c.id
      }
      return null
    }

    // Match remplaçant by first name (for "Pâquis pour Carine" where Carine is a remplaçant)
    const matchRemplacantByFirstName = (firstName: string): number | null => {
      const cleanName = normalizeAccents(firstName.toLowerCase().trim())
      for (const r of dbRemplacants) {
        const firstNameDb = normalizeAccents(r.firstName.toLowerCase())
        if (firstNameDb === cleanName) return r.id
        if (firstNameDb.includes(cleanName) || cleanName.includes(firstNameDb)) return r.id
        const parts = firstNameDb.split('-')
        for (const part of parts) {
          if (part === cleanName || part.includes(cleanName) || cleanName.includes(part)) return r.id
        }
        // Flexible matching: "charlèneK" → "Lys-Charlène KASSI ROBERT"
        if (flexibleNameMatch(firstName, r.firstName, r.lastName)) return r.id
      }
      return null
    }

    // Match parsed names to DB records - first try remplaçants, then collaborateurs (accent-insensitive)
    const matchPerson = (name: string): { id: number; type: 'remplacant' | 'collaborateur' } | null => {
      const cleanName = normalizeAccents(name.replace(/\r?\n/g, ' ').trim().toLowerCase())

      // Try remplaçants first
      for (const r of dbRemplacants) {
        const fullName1 = normalizeAccents(`${r.firstName} ${r.lastName}`.toLowerCase())
        const fullName2 = normalizeAccents(`${r.lastName} ${r.firstName}`.toLowerCase())
        const lastNameOnly = normalizeAccents(r.lastName.toLowerCase())

        if (cleanName.includes(fullName1) || cleanName.includes(fullName2) ||
            fullName1.includes(cleanName) || fullName2.includes(cleanName) ||
            cleanName.startsWith(lastNameOnly) || cleanName.includes(lastNameOnly)) {
          return { id: r.id, type: 'remplacant' }
        }
        if (flexibleNameMatch(name, r.firstName, r.lastName)) {
          return { id: r.id, type: 'remplacant' }
        }
      }

      // Then try collaborateurs
      for (const c of dbCollaborateurs) {
        const fullName1 = normalizeAccents(`${c.firstName} ${c.lastName}`.toLowerCase())
        const fullName2 = normalizeAccents(`${c.lastName} ${c.firstName}`.toLowerCase())
        const lastNameOnly = normalizeAccents(c.lastName.toLowerCase())

        if (cleanName.includes(fullName1) || cleanName.includes(fullName2) ||
            fullName1.includes(cleanName) || fullName2.includes(cleanName) ||
            cleanName.startsWith(lastNameOnly) || cleanName.includes(lastNameOnly)) {
          return { id: c.id, type: 'collaborateur' }
        }
        if (flexibleNameMatch(name, c.firstName, c.lastName)) {
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
              let ecoleId = matchEcole(parsed.ecoleName)
              let personName = parsed.personName
              // Try collaborateur first, then remplaçant
              let collabId = personName ? matchCollaborateurByFirstName(personName) : null
              let remplacantId = personName && !collabId ? matchRemplacantByFirstName(personName) : null

              // Fallback: if no école matched and no person specified, the "ecoleName" might actually
              // be a person's first name (e.g., "Nadine" = collaborateur being replaced)
              if (!ecoleId && !personName) {
                const collabAsName = matchCollaborateurByFirstName(parsed.ecoleName)
                if (collabAsName) {
                  collabId = collabAsName
                  personName = parsed.ecoleName
                  ecoleId = collabEcoleMap.get(collabAsName) ?? null
                }
              }

              const personId = collabId || remplacantId
              affectationParsed = {
                ecoleName: ecoleId ? (dbEcoles.find(e => e.id === ecoleId)?.name ?? parsed.ecoleName) : parsed.ecoleName,
                personName,
                ecoleFound: ecoleId !== null,
                ecoleId,
                personFound: personName ? personId !== null : false,
                personId,
                personType: collabId ? 'collaborateur' : remplacantId ? 'remplacant' : undefined,
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
    let absencesCreated = 0
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
          // Check if "malade" → create absence for this remplaçant
          if (d.note && d.note.toLowerCase() === 'malade') {
            await db
              .insert(absences)
              .values({
                type: 'remplacant',
                remplacantId: match.id,
                dateDebut: d.date,
                dateFin: d.date,
                creneau: d.creneau,
                motif: 'maladie',
                isActive: true,
                createdBy: user.id,
                updatedBy: user.id,
              })
            absencesCreated++
            continue // Skip disponibilité creation
          }

          // Check if this is an affectation (has note with école and person)
          if (d.note) {
            const parsed = parseAffectationNote(d.note)
            if (parsed) {
              let ecoleId = matchEcole(parsed.ecoleName)
              // Try collaborateur first, then remplaçant
              let collaborateurId = parsed.personName ? matchCollaborateurByFirstName(parsed.personName) : null

              // Fallback: if no école matched and no person specified, the "ecoleName" might actually
              // be a person's first name (e.g., "Nadine" = collaborateur being replaced)
              if (!ecoleId && !parsed.personName) {
                const collabAsName = matchCollaborateurByFirstName(parsed.ecoleName)
                if (collabAsName) {
                  collaborateurId = collabAsName
                  ecoleId = collabEcoleMap.get(collabAsName) ?? null
                }
              }

              if (ecoleId && collaborateurId) {
                // Create affectation (collaborateur found)
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
              // If person is a remplaçant (e.g., "Pâquis pour Carine" where Carine is a remplaçant),
              // we can't create an affectation (requires collaborateurId), so fall through to disponibilité
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
      absencesCreated,
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
