import { NextRequest, NextResponse } from 'next/server'
import { eq, and, ilike } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import {
  etablissements,
  ecoles,
  directeurs,
  titulaires,
  titulaireAffectations,
  collaborateurEcoles,
  ecoleTaux,
  periodesScolaires,
} from '@/lib/db/schema'
import { collaborateurs } from '@/lib/db/schema/collaborateurs'
import { requireRole } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

// ─── Types ──────────────────────────────────────────────────────

type JourPresence = {
  jour: 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi'
  creneau: 'matin' | 'apres_midi' | 'journee'
}

type ParsedCollaborateur = {
  lastName: string
  firstName: string
  taux: string | null  // "50.00" ou null
  id?: number
  found: boolean
  remplacePour: {
    lastName: string
    firstName: string
    id?: number
    found: boolean
  } | null
}

interface ParsedRow {
  row: number
  etablissement: { name: string; isNew: boolean; id?: number }
  ecole: { name: string; isNew: boolean; id?: number; email?: string | null }
  directeur: { lastName: string; firstName: string; email?: string | null; isNew: boolean; id?: number } | null
  collaborateursSEI: ParsedCollaborateur[]  // Array, peut contenir 0, 1 ou 2+ collaborateurs
  collaborateurJoursPresence: JourPresence[]
  titulaire1: { lastName: string; firstName: string; email?: string | null; phone?: string | null; joursPresence: JourPresence[]; isNew: boolean; id?: number } | null
  titulaire2: { lastName: string; firstName: string; email?: string | null; phone?: string | null; joursPresence: JourPresence[]; isNew: boolean; id?: number } | null
  remplacementApresJours: string | null
  tauxEngagement: string | null
  tauxCoIntervention: string | null
  commentaires: string | null
  error?: string
}

// ─── Helper Functions ───────────────────────────────────────────

function cleanName(raw: string): string {
  if (!raw) return ''
  // Enlever les caractères spéciaux au début et à la fin (apostrophes, guillemets, etc.)
  // Enlever "(Remplace ...)" ou "(rempl. ...)"
  // Enlever "à X%" ou "a X%" ou juste "X %" ou "X%"
  return raw
    .replace(/\(\s*(?:remplace|rempl\.?)\s+.+?\s*\)/gi, '')
    .replace(/[àa]\s*\d+(?:[.,]\d+)?\s*%/gi, '')
    .replace(/\d+(?:[.,]\d+)?\s*%/gi, '')  // Enlever aussi "50 %" ou "50%" seul
    .replace(/^['"`'']+/g, '')  // Apostrophes au début
    .replace(/['"`'']+$/g, '')  // Apostrophes à la fin
    .trim()
}

// Enlever les accents d'une chaîne
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Normaliser un nom pour la comparaison (remplacer tirets par espaces, enlever accents)
function normalizeNameForSearch(name: string): string {
  return removeAccents(name.toLowerCase()).replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

// Normaliser en enlevant tous les séparateurs (pour comparaison très flexible)
function normalizeNameStrict(name: string): string {
  return removeAccents(name.toLowerCase()).replace(/[-\s]/g, '').trim()
}

// Rechercher un collaborateur de façon flexible (gère les variations de parsing prénom/nom)
function findCollaborateur(
  firstName: string,
  lastName: string,
  collaborateurs: Array<{ id: number; lastName: string; firstName: string }>
): { id: number; lastName: string; firstName: string } | undefined {
  const firstNorm = normalizeNameForSearch(firstName)
  const lastNorm = normalizeNameForSearch(lastName)
  const fullNorm = `${firstNorm} ${lastNorm}`.trim()

  // 1. Recherche exacte (normalisée)
  let found = collaborateurs.find(c =>
    normalizeNameForSearch(c.lastName) === lastNorm &&
    normalizeNameForSearch(c.firstName) === firstNorm
  )
  if (found) return found

  // 2. Recherche par nom complet (gère "Laura Di DIO" vs "Laura DI DIO")
  found = collaborateurs.find(c => {
    const cFullNorm = `${normalizeNameForSearch(c.firstName)} ${normalizeNameForSearch(c.lastName)}`.trim()
    return cFullNorm === fullNorm
  })
  if (found) return found

  // 3. Recherche si le nom de famille contient une particule (Di, De, Van, etc.)
  // Ex: fichier "Laura Di DIO" → cherche "Laura" + "DI DIO" ou "Di DIO"
  found = collaborateurs.find(c => {
    const cLastNorm = normalizeNameForSearch(c.lastName)
    const cFirstNorm = normalizeNameForSearch(c.firstName)
    // Le nom complet du fichier correspond au nom de famille dans la base ?
    // Ex: "di dio" (du fichier comme lastName) est contenu dans "di dio" (base lastName)
    return cLastNorm.includes(lastNorm) && cFirstNorm === firstNorm
  })
  if (found) return found

  // 4. Recherche inversée : peut-être que la particule est dans le prénom du fichier
  // Ex: fichier firstName="Laura Di" lastName="DIO" vs base firstName="Laura" lastName="DI DIO"
  found = collaborateurs.find(c => {
    const cFullNorm = `${normalizeNameForSearch(c.firstName)} ${normalizeNameForSearch(c.lastName)}`
    // Vérifie si tous les mots du fichier sont présents dans le nom complet de la base
    const fileWords = fullNorm.split(' ').filter(Boolean)
    const baseWords = cFullNorm.split(' ').filter(Boolean)
    return fileWords.length === baseWords.length &&
           fileWords.every(w => baseWords.includes(w))
  })
  if (found) return found

  // 5. Recherche par nom seul si prénom vide ou match partiel
  if (!firstName || firstName.trim() === '') {
    found = collaborateurs.find(c => normalizeNameForSearch(c.lastName) === lastNorm)
    if (found) return found
  }

  // 6. Recherche très flexible : enlever tous les espaces et tirets
  // Ex: "DEJARDIN" vs "DE JARDIN", "FRAVOD-COUNE" vs "FRAVOD COUNE"
  const fullStrict = normalizeNameStrict(`${firstName} ${lastName}`)
  found = collaborateurs.find(c => {
    const cFullStrict = normalizeNameStrict(`${c.firstName} ${c.lastName}`)
    return cFullStrict === fullStrict
  })
  if (found) return found

  // 7. Recherche par nom de famille seul (strict, sans espaces/tirets)
  const lastStrict = normalizeNameStrict(lastName)
  found = collaborateurs.find(c => {
    const cLastStrict = normalizeNameStrict(c.lastName)
    const cFirstNorm = normalizeNameForSearch(c.firstName)
    return cLastStrict === lastStrict && cFirstNorm === firstNorm
  })
  if (found) return found

  return undefined
}

// Nettoyer email/téléphone qui peuvent contenir plusieurs valeurs: "value1 (value2)"
function cleanContactField(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // Prendre seulement la première valeur (avant la parenthèse)
  const match = trimmed.match(/^([^(]+)/)
  if (match) {
    return match[1].trim() || null
  }
  return trimmed || null
}

function parseName(raw: string): { lastName: string; firstName: string } {
  if (!raw || !raw.trim()) return { lastName: '', firstName: '' }

  // Nettoyer le nom d'abord
  const trimmed = cleanName(raw)
  if (!trimmed) return { lastName: '', firstName: '' }

  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) {
    return { lastName: trimmed.toUpperCase(), firstName: '' }
  }

  // Détecter si c'est "NOM Prénom" ou "Prénom NOM"
  // Un mot est considéré comme NOM s'il est tout en majuscules
  const isAllUpper = (s: string) => s === s.toUpperCase() && /[A-ZÀ-Ü]/.test(s)

  // Format "NOM Prénom" : premier(s) mot(s) en majuscules
  // Ex: "DUPONT Marie" ou "DE LA FONTAINE Jean"
  let lastNameParts: string[] = []
  let firstNameParts: string[] = []
  let foundLowerCase = false

  for (const part of parts) {
    if (!foundLowerCase && isAllUpper(part)) {
      lastNameParts.push(part)
    } else {
      foundLowerCase = true
      firstNameParts.push(part)
    }
  }

  // Si on a trouvé des parties en majuscules au début → format "NOM Prénom"
  if (lastNameParts.length > 0 && firstNameParts.length > 0) {
    return {
      lastName: lastNameParts.join(' ').toUpperCase(),
      firstName: firstNameParts.join(' ')
    }
  }

  // Format "Prénom NOM" : dernier(s) mot(s) en majuscules
  // Ex: "Marie DUPONT" ou "Jean DE LA FONTAINE"
  const matchPrenomNom = trimmed.match(/^(.+?)\s+([A-ZÀ-Ü\s-]+)$/)
  if (matchPrenomNom) {
    const first = matchPrenomNom[1].trim()
    const last = matchPrenomNom[2].trim().toUpperCase()
    return { lastName: last, firstName: first }
  }

  // Fallback: assume "Prénom Nom" - prendre le dernier mot comme nom
  const first = parts.slice(0, -1).join(' ')
  const last = parts[parts.length - 1].toUpperCase()
  return { lastName: last, firstName: first }
}

function parseJoursPresenceText(text: string | null): JourPresence[] {
  if (!text || text.trim().toLowerCase() === 'non') return []

  const result: JourPresence[] = []
  let input = text.toLowerCase()
    .replace(/après-midi|après midi|apres-midi|apres midi|aprem|am/g, 'apres_midi')
    .replace(/toute la journée|toute la jourmée|journee complète|journée complète/g, 'journee')
    .replace(/\+/g, ',')

  // Cas spéciaux: tous les jours
  if (input.includes('tous les jours') || input.includes('toute la semaine')) {
    const jours: Array<'lundi'|'mardi'|'mercredi'|'jeudi'|'vendredi'> =
      ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']

    // Vérifier exclusions "sauf..."
    const saufMatch = input.match(/sauf\s+(?:le\s+)?(\w+)(?:\s+(matin|apres_midi|journee))?/)

    for (const jour of jours) {
      if (saufMatch && saufMatch[1].includes(jour.slice(0, 3))) {
        const creneauExclu = saufMatch[2] || 'journee'
        if (creneauExclu === 'matin') {
          result.push({ jour, creneau: 'apres_midi' })
        } else if (creneauExclu === 'apres_midi') {
          result.push({ jour, creneau: 'matin' })
        }
      } else {
        result.push({ jour, creneau: 'journee' })
      }
    }
    return result
  }

  // Patterns pour chaque jour
  const joursPatterns: Array<{regex: RegExp, jour: 'lundi'|'mardi'|'mercredi'|'jeudi'|'vendredi'}> = [
    { regex: /lund\w*/g, jour: 'lundi' },
    { regex: /mard\w*/g, jour: 'mardi' },
    { regex: /mercred\w*/g, jour: 'mercredi' },
    { regex: /jeud\w*/g, jour: 'jeudi' },
    { regex: /vendred\w*/g, jour: 'vendredi' },
  ]

  // Short forms
  const shortPatterns: Array<{regex: RegExp, jour: 'lundi'|'mardi'|'mercredi'|'jeudi'|'vendredi'}> = [
    { regex: /\blu\b/g, jour: 'lundi' },
    { regex: /\bma\b/g, jour: 'mardi' },
    { regex: /\bme\b/g, jour: 'mercredi' },
    { regex: /\bje\b/g, jour: 'jeudi' },
    { regex: /\bve\b/g, jour: 'vendredi' },
  ]

  // Extraire les segments (séparés par virgule, "et", etc.)
  const segments = input.split(/[,;]|\bet\b/).map(s => s.trim()).filter(Boolean)

  for (const segment of segments) {
    // Trouver le créneau dans ce segment
    let creneau: 'matin' | 'apres_midi' | 'journee' = 'journee'
    if (segment.includes('matin') && !segment.includes('apres_midi')) {
      creneau = 'matin'
    } else if (segment.includes('apres_midi') && !segment.includes('matin')) {
      creneau = 'apres_midi'
    } else if (segment.includes('journee') || segment.includes('journée')) {
      creneau = 'journee'
    }

    // Trouver les jours dans ce segment (full patterns first)
    let foundJour = false
    for (const { regex, jour } of joursPatterns) {
      if (regex.test(segment)) {
        if (!result.some(r => r.jour === jour && r.creneau === creneau)) {
          result.push({ jour, creneau })
        }
        foundJour = true
      }
      regex.lastIndex = 0
    }

    // Try short patterns if no full match
    if (!foundJour) {
      for (const { regex, jour } of shortPatterns) {
        if (regex.test(segment)) {
          if (!result.some(r => r.jour === jour && r.creneau === creneau)) {
            result.push({ jour, creneau })
          }
        }
        regex.lastIndex = 0
      }
    }
  }

  // Trier par jour de la semaine
  const ordre = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']
  return result.sort((a, b) => ordre.indexOf(a.jour) - ordre.indexOf(b.jour))
}

function combineJoursPresence(text1: string | null, text2: string | null): JourPresence[] {
  const jours1 = parseJoursPresenceText(text1)
  const jours2 = parseJoursPresenceText(text2)
  const all = [...jours1, ...jours2]

  // Dédupliquer (même jour + même créneau)
  const unique = all.filter((item, idx) =>
    all.findIndex(x => x.jour === item.jour && x.creneau === item.creneau) === idx
  )

  // Trier
  const ordre = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']
  return unique.sort((a, b) => ordre.indexOf(a.jour) - ordre.indexOf(b.jour))
}

function normalizeKey(key: string): string {
  return removeAccents(key.toLowerCase())
    .replace(/\s+/g, ' ')  // Normaliser espaces multiples
    .replace(/n°/g, 'n')   // n° → n
    .replace(/°/g, '')     // Supprimer °
    .replace(/[''`]/g, '') // Supprimer apostrophes
    .trim()
}

function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  // 1. Essayer d'abord la correspondance exacte (pour la performance)
  for (const key of keys) {
    const val = row[key]
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim()
    }
  }

  // 2. Si pas trouvé, essayer une correspondance case-insensitive/normalisée
  const normalizedKeys = keys.map(normalizeKey)
  for (const rowKey of Object.keys(row)) {
    const normalizedRowKey = normalizeKey(rowKey)
    for (let i = 0; i < normalizedKeys.length; i++) {
      if (normalizedRowKey === normalizedKeys[i] || normalizedRowKey.includes(normalizedKeys[i])) {
        const val = row[rowKey]
        if (val !== undefined && val !== null && val !== '') {
          return String(val).trim()
        }
      }
    }
  }

  return ''
}

function findKey(row: Record<string, unknown>, ...patterns: string[]): unknown {
  for (const key of Object.keys(row)) {
    const keyNormalized = normalizeKey(key)
    for (const pattern of patterns) {
      const patternNormalized = normalizeKey(pattern)
      if (keyNormalized.includes(patternNormalized)) {
        return row[key]
      }
    }
  }
  return null
}

function parseExcelFromC5(buffer: Buffer): { rows: Record<string, unknown>[]; detectedColumns: string[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Modifier la plage pour démarrer à C5
  const originalRange = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const newRange = {
    s: { c: 2, r: 4 },  // C5 (col C = index 2, row 5 = index 4)
    e: originalRange.e
  }
  sheet['!ref'] = XLSX.utils.encode_range(newRange)

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  const detectedColumns = rows.length > 0 ? Object.keys(rows[0]) : []

  return { rows, detectedColumns }
}

function parseDecimal(value: unknown): string | null {
  if (!value) return null
  const str = String(value).trim().replace(',', '.').replace('%', '')
  const num = parseFloat(str)
  if (isNaN(num)) return null
  return num.toFixed(2)
}

function parseCollaborateursWithTaux(
  raw: string | null,
  fallbackTaux: string | null,
  existingCollaborateurs: Array<{ id: number; lastName: string; firstName: string }>
): ParsedCollaborateur[] {
  if (!raw || raw.trim().toLowerCase() === 'non') return []

  const result: ParsedCollaborateur[] = []

  // Séparer par "+" pour multi-collaborateurs
  const parts = raw.split('+').map(p => p.trim()).filter(Boolean)

  for (const part of parts) {
    // Extraire "(remplace Prénom NOM)" ou "(rempl. Prénom NOM)"
    const remplacementMatch = part.match(/\(\s*(?:remplace|rempl\.?)\s+(.+?)\s*\)/i)
    let remplacePour: ParsedCollaborateur['remplacePour'] = null

    if (remplacementMatch) {
      const remplaceName = remplacementMatch[1].trim()
      const { lastName: rLastName, firstName: rFirstName } = parseName(remplaceName)
      if (rLastName) {
        // Recherche flexible (gère les variations de parsing)
        const existingRemplace = findCollaborateur(rFirstName, rLastName, existingCollaborateurs)
        remplacePour = {
          lastName: rLastName,
          firstName: rFirstName,
          id: existingRemplace?.id,
          found: !!existingRemplace
        }
      }
    }

    // Enlever la partie "(remplace ...)" pour parser le reste
    let cleanPart = part.replace(/\(\s*(?:remplace|rempl\.?)\s+.+?\s*\)/i, '').trim()

    // Extraire le pourcentage: "Prénom NOM 50%" ou "Prénom NOM 50 %"
    const tauxMatch = cleanPart.match(/(\d+(?:[.,]\d+)?)\s*%/)
    const taux = tauxMatch ? parseDecimal(tauxMatch[1]) : null

    // Enlever le pourcentage du nom
    const nameOnly = cleanPart.replace(/\d+(?:[.,]\d+)?\s*%/, '').trim()
    const { lastName, firstName } = parseName(nameOnly)

    if (!lastName) continue

    // Matcher avec collaborateurs existants (recherche flexible)
    const existing = findCollaborateur(firstName, lastName, existingCollaborateurs)

    result.push({
      lastName,
      firstName,
      taux,
      id: existing?.id,
      found: !!existing,
      remplacePour
    })
  }

  // Si un seul collaborateur sans taux explicite, utiliser le taux de la colonne
  if (result.length === 1 && !result[0].taux && fallbackTaux) {
    result[0].taux = fallbackTaux
  }

  return result
}

function parseInt(value: unknown): number | null {
  if (!value) return null
  const str = String(value).trim()
  const num = Number.parseInt(str, 10)
  if (isNaN(num)) return null
  return num
}

// ─── Main POST Handler ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireRole(['admin'])

    const { searchParams } = new URL(request.url)
    const previewMode = searchParams.get('preview') === 'true'
    const periodeCode = searchParams.get('periode') || 'R25'

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, detectedColumns } = parseExcelFromC5(buffer)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 })
    }

    // Get période
    const [periode] = await db
      .select()
      .from(periodesScolaires)
      .where(eq(periodesScolaires.code, periodeCode))
      .limit(1)

    if (!periode) {
      return NextResponse.json({ error: `Période ${periodeCode} non trouvée` }, { status: 400 })
    }

    // Preload existing data for matching
    const existingEtabs = await db.select().from(etablissements)
    const existingEcoles = await db.select().from(ecoles)
    const existingDirecteurs = await db.select().from(directeurs)
    const existingTitulaires = await db.select().from(titulaires)
    const existingCollaborateurs = await db.select().from(collaborateurs)

    const parsed: ParsedRow[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 6 // C5 is row 5, so data starts at 6 (1-indexed header at 5)

      try {
        // ─── Établissement ────
        const etabName = getCell(row, 'Etablissement', 'Établissement', 'etablissement')
        if (!etabName) {
          parsed.push({
            row: rowNum,
            etablissement: { name: '', isNew: false },
            ecole: { name: '', isNew: false },
            directeur: null,
            collaborateursSEI: [],
            collaborateurJoursPresence: [],
            titulaire1: null,
            titulaire2: null,
            remplacementApresJours: null,
            tauxEngagement: null,
            tauxCoIntervention: null,
            commentaires: null,
            error: 'Établissement manquant'
          })
          continue
        }

        const existingEtab = existingEtabs.find(e => e.name.toLowerCase() === etabName.toLowerCase())

        // ─── École ────
        const ecoleName = getCell(row, 'Ecole', 'École', 'ecole')
        if (!ecoleName) {
          parsed.push({
            row: rowNum,
            etablissement: { name: etabName, isNew: !existingEtab, id: existingEtab?.id },
            ecole: { name: '', isNew: false },
            directeur: null,
            collaborateursSEI: [],
            collaborateurJoursPresence: [],
            titulaire1: null,
            titulaire2: null,
            remplacementApresJours: null,
            tauxEngagement: null,
            tauxCoIntervention: null,
            commentaires: null,
            error: 'École manquante'
          })
          continue
        }

        const ecoleEmail = getCell(row, 'E-mail école', 'Email école', 'email ecole', 'Email ecole')
        const existingEcole = existingEcoles.find(e =>
          e.name.toLowerCase() === ecoleName.toLowerCase() &&
          (existingEtab ? e.etablissementId === existingEtab.id : true)
        )

        // ─── Directeur ────
        const directeurNomRaw = getCell(row, 'Nom Direction', 'Nom direction', 'Direction', 'Directeur')
        const directeurEmail = getCell(row, 'Email direction', 'Email Direction', 'E-mail direction')
        let directeurData: ParsedRow['directeur'] = null

        if (directeurNomRaw) {
          const { lastName, firstName } = parseName(directeurNomRaw)
          if (lastName) {
            // Match by email first, then by name
            let existingDir = directeurEmail
              ? existingDirecteurs.find(d => d.email?.toLowerCase() === directeurEmail.toLowerCase())
              : null
            if (!existingDir) {
              existingDir = existingDirecteurs.find(d =>
                d.lastName.toLowerCase() === lastName.toLowerCase() &&
                d.firstName.toLowerCase() === firstName.toLowerCase()
              )
            }
            directeurData = {
              lastName,
              firstName,
              email: directeurEmail || null,
              isNew: !existingDir,
              id: existingDir?.id
            }
          }
        }

        // ─── Collaborateur SEI ────
        const collabNomRaw = getCell(row, 'Nom co-int. SEI', 'Nom co-int SEI', 'Co-int SEI', 'ISEPS', 'Nom ISEPS')
        const tauxCoInterventionColonne = parseDecimal(findKey(row, 'Taux de co-intervention', 'co-intervention R25'))

        const collaborateursSEI = parseCollaborateursWithTaux(
          collabNomRaw,
          tauxCoInterventionColonne,
          existingCollaborateurs
        )

        // Jours présence ISEPS (combinaison Tit1 + Tit2) - partagés par tous les collaborateurs
        const joursTit1 = getCell(row, 'jours de présence ISEPS avec Tit 1', 'jours présence ISEPS Tit 1', 'jours presence ISEPS Tit 1', 'Jours ISEPS Tit 1', 'jours de présence de ISEPS avec Tit 1', 'jours présence ISEPS avec Tit 1', 'présence ISEPS Tit 1', 'ISEPS Tit 1')
        const joursTit2 = getCell(row, 'jours de présence ISEPS avec Tit 2', 'jours de présence de ISEPS avec Tit 2', 'jours présence ISEPS Tit 2', 'jours presence ISEPS Tit 2', 'Jours ISEPS Tit 2', 'jours présence ISEPS avec Tit 2', 'présence ISEPS Tit 2', 'ISEPS Tit 2')
        const collabJoursPresence = combineJoursPresence(joursTit1, joursTit2)

        // ─── Titulaire 1 ────
        const tit1NomRaw = getCell(row, 'Nom titulaire n°1', 'Nom titulaire 1', 'Titulaire 1', 'Titulaire n°1', 'Tit 1', 'Tit1', 'titulaire 1', 'titulaire n°1', 'Nom Tit 1')
        const tit1EmailRaw = getCell(row, 'Mail titulaire n°1', 'Email titulaire 1', 'Mail titulaire 1', 'E-mail titulaire 1', 'Mail Tit 1')
        const tit1PhoneRaw = getCell(row, 'No tél. Tit n°1', 'Tel titulaire 1', 'Téléphone titulaire 1', 'Tél Tit 1', 'Tel Tit 1')
        const tit1JoursRaw = getCell(row, 'jours de présence ISEPS avec Tit 1', 'jours de présence de ISEPS avec Tit 1', 'jours presence ISEPS Tit 1', 'jours présence ISEPS Tit 1', 'jours présence ISEPS avec Tit 1', 'Jours Tit 1', 'Jours présence Tit 1', 'présence ISEPS Tit 1', 'ISEPS Tit 1')
        // Nettoyer email/téléphone qui peuvent contenir plusieurs valeurs
        const tit1Email = cleanContactField(tit1EmailRaw)
        const tit1Phone = cleanContactField(tit1PhoneRaw)
        let titulaire1Data: ParsedRow['titulaire1'] = null

        // "non" means no titulaire
        if (tit1NomRaw && tit1NomRaw.toLowerCase().trim() !== 'non') {
          const { lastName, firstName } = parseName(tit1NomRaw)
          if (lastName) {
            let existingTit = tit1Email
              ? existingTitulaires.find(t => t.email?.toLowerCase() === tit1Email.toLowerCase())
              : null
            if (!existingTit) {
              existingTit = existingTitulaires.find(t =>
                t.lastName.toLowerCase() === lastName.toLowerCase() &&
                t.firstName.toLowerCase() === firstName.toLowerCase()
              )
            }
            titulaire1Data = {
              lastName,
              firstName,
              email: tit1Email,
              phone: tit1Phone,
              joursPresence: parseJoursPresenceText(tit1JoursRaw),
              isNew: !existingTit,
              id: existingTit?.id
            }
          }
        }

        // ─── Titulaire 2 ────
        const tit2NomRaw = getCell(row, 'Nom titulaire n°2', 'Nom titulaire 2', 'Titulaire 2', 'Titulaire n°2', 'Tit 2', 'Tit2', 'titulaire 2', 'titulaire n°2', 'Nom Tit 2')
        const tit2EmailRaw = getCell(row, 'Mail titulaire n°2', 'Email titulaire 2', 'Mail titulaire 2', 'E-mail titulaire 2', 'Mail Tit 2')
        const tit2PhoneRaw = getCell(row, 'No tél. Tit n°2', 'Tel titulaire 2', 'Téléphone titulaire 2', 'Tél Tit 2', 'Tel Tit 2')
        const tit2JoursRaw = getCell(row, 'jours de présence ISEPS avec Tit 2', 'jours de présence de ISEPS avec Tit 2', 'jours presence ISEPS Tit 2', 'jours présence ISEPS Tit 2', 'jours présence ISEPS avec Tit 2', 'Jours Tit 2', 'Jours présence Tit 2', 'présence ISEPS Tit 2', 'ISEPS Tit 2')
        // Nettoyer email/téléphone qui peuvent contenir plusieurs valeurs
        const tit2Email = cleanContactField(tit2EmailRaw)
        const tit2Phone = cleanContactField(tit2PhoneRaw)
        let titulaire2Data: ParsedRow['titulaire2'] = null

        // "non" means no second titulaire
        if (tit2NomRaw && tit2NomRaw.toLowerCase().trim() !== 'non') {
          const { lastName, firstName } = parseName(tit2NomRaw)
          if (lastName) {
            let existingTit = tit2Email
              ? existingTitulaires.find(t => t.email?.toLowerCase() === tit2Email.toLowerCase())
              : null
            if (!existingTit) {
              existingTit = existingTitulaires.find(t =>
                t.lastName.toLowerCase() === lastName.toLowerCase() &&
                t.firstName.toLowerCase() === firstName.toLowerCase()
              )
            }
            titulaire2Data = {
              lastName,
              firstName,
              email: tit2Email,
              phone: tit2Phone,
              joursPresence: parseJoursPresenceText(tit2JoursRaw),
              isNew: !existingTit,
              id: existingTit?.id
            }
          }
        }

        // ─── Autres champs ────
        const remplacementJoursRaw = findKey(row, 'Remplacement nécessaire', 'remplacement apres', 'après X jours')
        const tauxEngagementRaw = findKey(row, "Taux d'engagement", 'Taux engagement', 'engagement R25')
        const tauxCoInterventionRaw = findKey(row, 'Taux de co-intervention', 'co-intervention R25')
        const commentairesRaw = getCell(row, 'Commentaires Astural', 'Commentaires', 'commentaires')

        parsed.push({
          row: rowNum,
          etablissement: { name: etabName, isNew: !existingEtab, id: existingEtab?.id },
          ecole: { name: ecoleName, isNew: !existingEcole, id: existingEcole?.id, email: ecoleEmail || null },
          directeur: directeurData,
          collaborateursSEI,
          collaborateurJoursPresence: collabJoursPresence,
          titulaire1: titulaire1Data,
          titulaire2: titulaire2Data,
          remplacementApresJours: remplacementJoursRaw != null && remplacementJoursRaw !== '' && !isNaN(Number(remplacementJoursRaw)) ? Number(remplacementJoursRaw).toString() : null,
          tauxEngagement: parseDecimal(tauxEngagementRaw),
          tauxCoIntervention: parseDecimal(tauxCoInterventionRaw),
          commentaires: commentairesRaw || null,
        })
      } catch {
        parsed.push({
          row: rowNum,
          etablissement: { name: '', isNew: false },
          ecole: { name: '', isNew: false },
          directeur: null,
          collaborateursSEI: [],
          collaborateurJoursPresence: [],
          titulaire1: null,
          titulaire2: null,
          remplacementApresJours: null,
          tauxEngagement: null,
          tauxCoIntervention: null,
          commentaires: null,
          error: 'Erreur de parsing'
        })
      }
    }

    if (previewMode) {
      return NextResponse.json({
        total: rows.length,
        valid: parsed.filter(p => !p.error).length,
        errors: parsed.filter(p => p.error),
        preview: parsed,
        detectedColumns,
        periode: { code: periode.code, label: periode.label },
      })
    }

    // ─── Import execution ────
    const errors: Array<{ row: number; message: string }> = []
    const stats = {
      etablissements: { created: 0, updated: 0 },
      ecoles: { created: 0, updated: 0 },
      directeurs: { created: 0, updated: 0 },
      titulaires: { created: 0, updated: 0 },
      titulaireAffectations: { created: 0, updated: 0 },
      collaborateurEcoles: { created: 0, updated: 0 },
      ecoleTaux: { created: 0, updated: 0 },
      warnings: [] as string[],
    }

    // Maps to track created entities during import
    const etabMap = new Map<string, number>()
    const ecoleMap = new Map<string, number>()
    const directeurMap = new Map<string, number>()
    const titulaireMap = new Map<string, number>()

    for (const item of parsed) {
      if (item.error) {
        errors.push({ row: item.row, message: item.error })
        continue
      }

      try {
        // ─── 1. Établissement ────
        let etabId = item.etablissement.id
        const etabKey = item.etablissement.name.toLowerCase()

        if (!etabId) {
          etabId = etabMap.get(etabKey)
        }

        if (!etabId) {
          // Check again in DB with ilike
          const [found] = await db
            .select()
            .from(etablissements)
            .where(ilike(etablissements.name, item.etablissement.name))
            .limit(1)

          if (found) {
            etabId = found.id
            etabMap.set(etabKey, etabId)
          } else {
            // Create
            const [inserted] = await db
              .insert(etablissements)
              .values({
                name: item.etablissement.name,
                createdBy: user.id,
                updatedBy: user.id,
              })
              .returning()
            etabId = inserted.id
            etabMap.set(etabKey, etabId)
            stats.etablissements.created++
          }
        }

        // ─── 2. École ────
        let ecoleId = item.ecole.id
        const ecoleKey = `${etabId}:${item.ecole.name.toLowerCase()}`

        if (!ecoleId) {
          ecoleId = ecoleMap.get(ecoleKey)
        }

        if (!ecoleId) {
          const [found] = await db
            .select()
            .from(ecoles)
            .where(and(
              ilike(ecoles.name, item.ecole.name),
              eq(ecoles.etablissementId, etabId)
            ))
            .limit(1)

          if (found) {
            ecoleId = found.id
            ecoleMap.set(ecoleKey, ecoleId)

            // Update école fields
            await db
              .update(ecoles)
              .set({
                email: item.ecole.email || found.email,
                remplacementApresJours: item.remplacementApresJours ?? found.remplacementApresJours,
                commentaires: item.commentaires || found.commentaires,
                updatedBy: user.id,
                updatedAt: new Date(),
              })
              .where(eq(ecoles.id, ecoleId))
            stats.ecoles.updated++
          } else {
            const [inserted] = await db
              .insert(ecoles)
              .values({
                name: item.ecole.name,
                etablissementId: etabId,
                email: item.ecole.email,
                remplacementApresJours: item.remplacementApresJours,
                commentaires: item.commentaires,
                createdBy: user.id,
                updatedBy: user.id,
              })
              .returning()
            ecoleId = inserted.id
            ecoleMap.set(ecoleKey, ecoleId)
            stats.ecoles.created++
          }
        } else {
          // Update existing école
          await db
            .update(ecoles)
            .set({
              email: item.ecole.email || undefined,
              remplacementApresJours: item.remplacementApresJours ?? undefined,
              commentaires: item.commentaires || undefined,
              updatedBy: user.id,
              updatedAt: new Date(),
            })
            .where(eq(ecoles.id, ecoleId))
          stats.ecoles.updated++
        }

        // ─── 3. Directeur ────
        if (item.directeur) {
          let directeurId = item.directeur.id
          const dirKey = `${item.directeur.lastName.toLowerCase()}:${item.directeur.firstName.toLowerCase()}`

          if (!directeurId) {
            directeurId = directeurMap.get(dirKey)
          }

          if (!directeurId) {
            // Try email match first
            if (item.directeur.email) {
              const [found] = await db
                .select()
                .from(directeurs)
                .where(ilike(directeurs.email, item.directeur.email))
                .limit(1)
              if (found) {
                directeurId = found.id
                directeurMap.set(dirKey, directeurId)
              }
            }

            // Then try name match
            if (!directeurId) {
              const [found] = await db
                .select()
                .from(directeurs)
                .where(and(
                  ilike(directeurs.lastName, item.directeur.lastName),
                  ilike(directeurs.firstName, item.directeur.firstName)
                ))
                .limit(1)
              if (found) {
                directeurId = found.id
                directeurMap.set(dirKey, directeurId)
              }
            }

            // Create if not found
            if (!directeurId) {
              const [inserted] = await db
                .insert(directeurs)
                .values({
                  lastName: item.directeur.lastName,
                  firstName: item.directeur.firstName,
                  email: item.directeur.email,
                  createdBy: user.id,
                  updatedBy: user.id,
                })
                .returning()
              directeurId = inserted.id
              directeurMap.set(dirKey, directeurId)
              stats.directeurs.created++
            }
          }

          // Link directeur to école
          await db
            .update(ecoles)
            .set({ directeurId, updatedBy: user.id, updatedAt: new Date() })
            .where(eq(ecoles.id, ecoleId))
        }

        // ─── 4. Collaborateurs SEI (multi) ────
        for (const collab of item.collaborateursSEI) {
          if (collab.found && collab.id) {
            const [existingAff] = await db
              .select()
              .from(collaborateurEcoles)
              .where(and(
                eq(collaborateurEcoles.collaborateurId, collab.id),
                eq(collaborateurEcoles.ecoleId, ecoleId),
                eq(collaborateurEcoles.periodeId, periode.id)
              ))
              .limit(1)

            const joursJSON = item.collaborateurJoursPresence.length > 0
              ? JSON.stringify(item.collaborateurJoursPresence)
              : null

            // ID du collaborateur remplacé (si trouvé)
            const remplacePourId = collab.remplacePour?.found ? collab.remplacePour.id : null

            if (existingAff) {
              await db
                .update(collaborateurEcoles)
                .set({
                  joursPresence: joursJSON,
                  tauxCoIntervention: collab.taux,
                  remplacePourCollaborateurId: remplacePourId,
                  updatedBy: user.id,
                  updatedAt: new Date(),
                })
                .where(eq(collaborateurEcoles.id, existingAff.id))
              stats.collaborateurEcoles.updated++
            } else {
              await db
                .insert(collaborateurEcoles)
                .values({
                  collaborateurId: collab.id,
                  ecoleId,
                  periodeId: periode.id,
                  joursPresence: joursJSON,
                  tauxCoIntervention: collab.taux,
                  remplacePourCollaborateurId: remplacePourId,
                  createdBy: user.id,
                  updatedBy: user.id,
                })
              stats.collaborateurEcoles.created++
            }

            // Warning si le collaborateur remplacé n'est pas trouvé
            if (collab.remplacePour && !collab.remplacePour.found) {
              stats.warnings.push(`Ligne ${item.row}: Collaborateur remplacé "${collab.remplacePour.firstName} ${collab.remplacePour.lastName}" non trouvé`)
            }
          } else if (!collab.found) {
            stats.warnings.push(`Ligne ${item.row}: Collaborateur "${collab.firstName} ${collab.lastName}" non trouvé`)
          }
        }

        // ─── 5. Titulaire 1 ────
        if (item.titulaire1) {
          let titId = item.titulaire1.id
          const titKey = `${item.titulaire1.lastName.toLowerCase()}:${item.titulaire1.firstName.toLowerCase()}`

          if (!titId) {
            titId = titulaireMap.get(titKey)
          }

          if (!titId) {
            // Try email match
            if (item.titulaire1.email) {
              const [found] = await db
                .select()
                .from(titulaires)
                .where(ilike(titulaires.email, item.titulaire1.email))
                .limit(1)
              if (found) {
                titId = found.id
                titulaireMap.set(titKey, titId)
              }
            }

            // Try name match
            if (!titId) {
              const [found] = await db
                .select()
                .from(titulaires)
                .where(and(
                  ilike(titulaires.lastName, item.titulaire1.lastName),
                  ilike(titulaires.firstName, item.titulaire1.firstName)
                ))
                .limit(1)
              if (found) {
                titId = found.id
                titulaireMap.set(titKey, titId)
              }
            }

            // Create
            if (!titId) {
              const [inserted] = await db
                .insert(titulaires)
                .values({
                  lastName: item.titulaire1.lastName,
                  firstName: item.titulaire1.firstName,
                  email: item.titulaire1.email,
                  phone: item.titulaire1.phone,
                  createdBy: user.id,
                  updatedBy: user.id,
                })
                .returning()
              titId = inserted.id
              titulaireMap.set(titKey, titId)
              stats.titulaires.created++
            }
          }

          // Create/update affectation
          const [existingAff] = await db
            .select()
            .from(titulaireAffectations)
            .where(and(
              eq(titulaireAffectations.titulaireId, titId),
              eq(titulaireAffectations.ecoleId, ecoleId),
              eq(titulaireAffectations.periodeId, periode.id)
            ))
            .limit(1)

          const joursJSON = item.titulaire1.joursPresence.length > 0
            ? JSON.stringify(item.titulaire1.joursPresence)
            : null

          if (existingAff) {
            await db
              .update(titulaireAffectations)
              .set({
                joursPresence: joursJSON,
                updatedBy: user.id,
                updatedAt: new Date(),
              })
              .where(eq(titulaireAffectations.id, existingAff.id))
            stats.titulaireAffectations.updated++
          } else {
            await db
              .insert(titulaireAffectations)
              .values({
                titulaireId: titId,
                ecoleId,
                periodeId: periode.id,
                joursPresence: joursJSON,
                createdBy: user.id,
                updatedBy: user.id,
              })
            stats.titulaireAffectations.created++
          }
        }

        // ─── 6. Titulaire 2 ────
        if (item.titulaire2) {
          let titId = item.titulaire2.id
          const titKey = `${item.titulaire2.lastName.toLowerCase()}:${item.titulaire2.firstName.toLowerCase()}`

          if (!titId) {
            titId = titulaireMap.get(titKey)
          }

          if (!titId) {
            if (item.titulaire2.email) {
              const [found] = await db
                .select()
                .from(titulaires)
                .where(ilike(titulaires.email, item.titulaire2.email))
                .limit(1)
              if (found) {
                titId = found.id
                titulaireMap.set(titKey, titId)
              }
            }

            if (!titId) {
              const [found] = await db
                .select()
                .from(titulaires)
                .where(and(
                  ilike(titulaires.lastName, item.titulaire2.lastName),
                  ilike(titulaires.firstName, item.titulaire2.firstName)
                ))
                .limit(1)
              if (found) {
                titId = found.id
                titulaireMap.set(titKey, titId)
              }
            }

            if (!titId) {
              const [inserted] = await db
                .insert(titulaires)
                .values({
                  lastName: item.titulaire2.lastName,
                  firstName: item.titulaire2.firstName,
                  email: item.titulaire2.email,
                  phone: item.titulaire2.phone,
                  createdBy: user.id,
                  updatedBy: user.id,
                })
                .returning()
              titId = inserted.id
              titulaireMap.set(titKey, titId)
              stats.titulaires.created++
            }
          }

          const [existingAff] = await db
            .select()
            .from(titulaireAffectations)
            .where(and(
              eq(titulaireAffectations.titulaireId, titId),
              eq(titulaireAffectations.ecoleId, ecoleId),
              eq(titulaireAffectations.periodeId, periode.id)
            ))
            .limit(1)

          const joursJSON = item.titulaire2.joursPresence.length > 0
            ? JSON.stringify(item.titulaire2.joursPresence)
            : null

          if (existingAff) {
            await db
              .update(titulaireAffectations)
              .set({
                joursPresence: joursJSON,
                updatedBy: user.id,
                updatedAt: new Date(),
              })
              .where(eq(titulaireAffectations.id, existingAff.id))
            stats.titulaireAffectations.updated++
          } else {
            await db
              .insert(titulaireAffectations)
              .values({
                titulaireId: titId,
                ecoleId,
                periodeId: periode.id,
                joursPresence: joursJSON,
                createdBy: user.id,
                updatedBy: user.id,
              })
            stats.titulaireAffectations.created++
          }
        }

        // ─── 7. Taux ────
        if (item.tauxEngagement || item.tauxCoIntervention) {
          const [existingTaux] = await db
            .select()
            .from(ecoleTaux)
            .where(and(
              eq(ecoleTaux.ecoleId, ecoleId),
              eq(ecoleTaux.periodeId, periode.id)
            ))
            .limit(1)

          if (existingTaux) {
            await db
              .update(ecoleTaux)
              .set({
                tauxEngagement: item.tauxEngagement ?? existingTaux.tauxEngagement,
                tauxCoIntervention: item.tauxCoIntervention ?? existingTaux.tauxCoIntervention,
                updatedBy: user.id,
                updatedAt: new Date(),
              })
              .where(eq(ecoleTaux.id, existingTaux.id))
            stats.ecoleTaux.updated++
          } else {
            await db
              .insert(ecoleTaux)
              .values({
                ecoleId,
                periodeId: periode.id,
                tauxEngagement: item.tauxEngagement,
                tauxCoIntervention: item.tauxCoIntervention,
                createdBy: user.id,
                updatedBy: user.id,
              })
            stats.ecoleTaux.created++
          }
        }

      } catch (err) {
        errors.push({ row: item.row, message: (err as Error).message })
      }
    }

    return NextResponse.json({
      stats,
      errors,
      periode: { code: periode.code, label: periode.label },
    })
  } catch (error) {
    console.error('Error importing etablissements:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
