import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { vacancesScolairesCache } from '@/lib/db/schema'
import { requireAuth, requireRole } from '@/lib/auth/server'

const OPENHOLIDAYS_BASE_URL = 'https://openholidaysapi.org'
const CACHE_DURATION_DAYS = 30

interface OpenHolidayItem {
  id: string
  startDate: string
  endDate: string
  type: string
  name: Array<{ language: string; text: string }>
}

// Helper: Extraire le nom français ou allemand
function extractName(names: Array<{ language: string; text: string }>): string {
  const fr = names.find((n) => n.language === 'FR')
  if (fr) return fr.text
  const de = names.find((n) => n.language === 'DE')
  if (de) return de.text
  return names[0]?.text || 'Sans nom'
}

// Helper: Fetch vacances scolaires depuis OpenHolidays API
async function fetchSchoolHolidays(year: number): Promise<OpenHolidayItem[]> {
  const url = `${OPENHOLIDAYS_BASE_URL}/SchoolHolidays?countryIsoCode=CH&subdivisionCode=CH-GE&validFrom=${year}-01-01&validTo=${year}-12-31&languageIsoCode=FR`

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`OpenHolidays API error: ${response.status}`)
  }

  return response.json()
}

// Helper: Fetch jours fériés depuis OpenHolidays API
async function fetchPublicHolidays(year: number): Promise<OpenHolidayItem[]> {
  const url = `${OPENHOLIDAYS_BASE_URL}/PublicHolidays?countryIsoCode=CH&subdivisionCode=CH-GE&validFrom=${year}-01-01&validTo=${year}-12-31&languageIsoCode=FR`

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`OpenHolidays API error: ${response.status}`)
  }

  return response.json()
}

// Helper: Vérifier si le cache est valide pour une année
async function isCacheValid(year: number): Promise<boolean> {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - CACHE_DURATION_DAYS)

  const [cached] = await db
    .select()
    .from(vacancesScolairesCache)
    .where(
      and(
        eq(vacancesScolairesCache.annee, year),
        gte(vacancesScolairesCache.fetchedAt, threshold)
      )
    )
    .limit(1)

  return !!cached
}

// Helper: Mettre à jour le cache pour une année
async function updateCache(year: number): Promise<void> {
  // Supprimer les anciennes entrées pour cette année
  await db
    .delete(vacancesScolairesCache)
    .where(eq(vacancesScolairesCache.annee, year))

  // Fetch vacances scolaires
  const schoolHolidays = await fetchSchoolHolidays(year)

  // Fetch jours fériés
  const publicHolidays = await fetchPublicHolidays(year)

  // Insérer vacances scolaires
  for (const holiday of schoolHolidays) {
    await db.insert(vacancesScolairesCache).values({
      annee: year,
      type: 'vacances',
      nom: extractName(holiday.name),
      dateDebut: holiday.startDate,
      dateFin: holiday.endDate,
    })
  }

  // Insérer jours fériés
  for (const holiday of publicHolidays) {
    await db.insert(vacancesScolairesCache).values({
      annee: year,
      type: 'ferie',
      nom: extractName(holiday.name),
      dateDebut: holiday.startDate,
      dateFin: holiday.endDate,
    })
  }
}

// GET - Récupérer les vacances/jours fériés
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const yearParam = searchParams.get('year')

    // Déterminer les années à récupérer
    const years: number[] = []
    if (yearParam) {
      years.push(parseInt(yearParam))
    } else if (startDate && endDate) {
      const startYear = parseInt(startDate.substring(0, 4))
      const endYear = parseInt(endDate.substring(0, 4))
      for (let y = startYear; y <= endYear; y++) {
        years.push(y)
      }
    } else {
      // Par défaut: année en cours et suivante
      const currentYear = new Date().getFullYear()
      years.push(currentYear, currentYear + 1)
    }

    // Vérifier/mettre à jour le cache pour chaque année
    for (const year of years) {
      const valid = await isCacheValid(year)
      if (!valid) {
        try {
          await updateCache(year)
        } catch (error) {
          console.error(`Failed to update cache for year ${year}:`, error)
          // Continuer avec le cache existant s'il y en a
        }
      }
    }

    // Récupérer les données du cache
    let conditions = []
    if (startDate && endDate) {
      conditions.push(lte(vacancesScolairesCache.dateDebut, endDate))
      conditions.push(gte(vacancesScolairesCache.dateFin, startDate))
    } else {
      // Filtrer par années
      const yearConditions = years.map((y) => eq(vacancesScolairesCache.annee, y))
      // Note: Drizzle ne supporte pas OR directement, on filtre en JS
    }

    const data = await db
      .select()
      .from(vacancesScolairesCache)
      .where(
        startDate && endDate
          ? and(
              lte(vacancesScolairesCache.dateDebut, endDate),
              gte(vacancesScolairesCache.dateFin, startDate)
            )
          : undefined
      )
      .orderBy(desc(vacancesScolairesCache.dateDebut))

    // Filtrer par années si pas de dates spécifiques
    const filteredData = startDate && endDate
      ? data
      : data.filter((d) => years.includes(d.annee))

    return NextResponse.json({ data: filteredData })
  } catch (error) {
    console.error('Error fetching vacances scolaires:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Forcer la mise à jour du cache (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const { year } = body

    if (!year) {
      // Mettre à jour année en cours et suivante
      const currentYear = new Date().getFullYear()
      await updateCache(currentYear)
      await updateCache(currentYear + 1)

      return NextResponse.json({
        data: { message: `Cache mis à jour pour ${currentYear} et ${currentYear + 1}` }
      })
    }

    await updateCache(year)

    return NextResponse.json({
      data: { message: `Cache mis à jour pour ${year}` }
    })
  } catch (error) {
    console.error('Error updating vacances cache:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
