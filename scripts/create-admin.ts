import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import { hash } from '@node-rs/argon2'

async function createAdmin() {
  const email = process.argv[2] || 'admin@astural.ch'
  const password = process.argv[3] || 'admin123'
  const name = process.argv[4] || 'admin'

  const hashedPassword = await hash(password)

  try {
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      })
      .returning()

    console.log('Admin created:', user.email)
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

createAdmin()
