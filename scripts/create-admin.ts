import { db } from '../lib/db'
import { users, account } from '../lib/db/schema'
import { hash } from '@node-rs/argon2'

async function createAdmin() {
  const email = process.argv[2] || 'admin@astural.ch'
  const password = process.argv[3] || 'admin123'
  const name = process.argv[4] || 'admin'

  const hashedPassword = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  })

  try {
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        role: 'admin',
        isActive: true,
      })
      .returning()

    // Créer l'entrée account (Better Auth credential provider)
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: hashedPassword,
    })

    console.log('Admin created:', user.email)
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

createAdmin()
