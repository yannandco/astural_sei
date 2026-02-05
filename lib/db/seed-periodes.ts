// Load environment variables
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { db } from './index'
import { periodesScolaires } from './schema'
import { eq } from 'drizzle-orm'

async function seedPeriodes() {
  console.log('Seeding périodes scolaires...')

  const periodes = [
    {
      code: 'R25',
      label: 'Rentrée 2025-2026',
      dateDebut: '2025-08-01',
      dateFin: '2026-07-31',
      isActive: true,
    },
    {
      code: 'R26',
      label: 'Rentrée 2026-2027',
      dateDebut: '2026-08-01',
      dateFin: '2027-07-31',
      isActive: true,
    },
  ]

  for (const periode of periodes) {
    // Check if exists
    const existing = await db
      .select()
      .from(periodesScolaires)
      .where(eq(periodesScolaires.code, periode.code))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(periodesScolaires).values(periode)
      console.log(`  Created période: ${periode.code} (${periode.label})`)
    } else {
      console.log(`  Période ${periode.code} already exists, skipping`)
    }
  }

  console.log('Done!')
  process.exit(0)
}

seedPeriodes().catch((err) => {
  console.error('Error seeding périodes:', err)
  process.exit(1)
})
