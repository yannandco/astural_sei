import 'dotenv/config'
import { db } from '../lib/db'
import { sql } from 'drizzle-orm'

async function migrate() {
  try {
    console.log('Dropping old tables...')
    await db.execute(sql`DROP TABLE IF EXISTS remplacant_disponibilites_recurrentes CASCADE`)
    await db.execute(sql`DROP TABLE IF EXISTS remplacant_disponibilites_periodes CASCADE`)
    console.log('Tables dropped successfully')
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

migrate()
