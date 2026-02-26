/**
 * Migration script: Lucia Auth → Better Auth
 *
 * This script:
 * 1. Reads existing users with their hashed passwords
 * 2. Creates account entries in the `account` table (credential provider)
 * 3. Sets emailVerified = true for all existing users
 * 4. Clears all existing sessions (forces re-login)
 *
 * Run with: npx tsx scripts/migrate-to-better-auth.ts
 *
 * IMPORTANT: Run the DB schema migration BEFORE running this script.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql, eq, and } from 'drizzle-orm'
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core'

const connectionString = process.env.DATABASE_URL!

if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const queryClient = postgres(connectionString)
const db = drizzle(queryClient)

// Define minimal table references for migration
const usersTable = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  password: text('password'),
  emailVerified: boolean('email_verified'),
})

const accountTable = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id').notNull(),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

const sessionsTable = pgTable('sessions', {
  id: text('id').primaryKey(),
})

async function migrate() {
  console.log('=== Migration Lucia Auth → Better Auth ===\n')

  // Step 1: Check if account table exists
  try {
    await db.select().from(accountTable).limit(1)
    console.log('[OK] account table exists')
  } catch {
    console.error('[ERROR] account table does not exist. Run DB migration first.')
    process.exit(1)
  }

  // Step 2: Get all users that have a password
  const usersWithPassword = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      password: usersTable.password,
    })
    .from(usersTable)

  console.log(`\nFound ${usersWithPassword.length} users to migrate`)

  // Step 3: Create account entries for users that don't already have one
  let migrated = 0
  let skipped = 0

  for (const user of usersWithPassword) {
    if (!user.password) {
      console.log(`  [SKIP] ${user.email} — no password`)
      skipped++
      continue
    }

    // Check if account already exists
    const [existing] = await db
      .select({ id: accountTable.id })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.userId, user.id),
          eq(accountTable.providerId, 'credential')
        )
      )
      .limit(1)

    if (existing) {
      console.log(`  [SKIP] ${user.email} — account already exists`)
      skipped++
      continue
    }

    await db.insert(accountTable).values({
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: user.password,
    })

    console.log(`  [OK] ${user.email} — account created`)
    migrated++
  }

  console.log(`\nMigrated: ${migrated}, Skipped: ${skipped}`)

  // Step 4: Set emailVerified = true for all existing users
  await db.execute(sql`UPDATE users SET email_verified = true WHERE email_verified = false`)
  console.log('\n[OK] Set emailVerified = true for all existing users')

  // Step 5: Clear all existing sessions (force re-login)
  await db.delete(sessionsTable)
  console.log('[OK] All existing sessions cleared (users will need to re-login)')

  console.log('\n=== Migration complete ===')
  console.log('Users can now log in via Better Auth.')
  process.exit(0)
}

migrate().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
