import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'
import { desc } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'

// GET /api/users - Liste tous les utilisateurs
export async function GET() {
  try {
    await requireRole(['admin'])

    const result = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))

    return NextResponse.json({ data: result })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'Non authentifié') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message === 'Accès non autorisé') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/users - Crée un nouvel utilisateur
export async function POST(request: Request) {
  try {
    await requireRole(['admin'])

    const body = await request.json()
    const { name, email, password, role } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nom, email et mot de passe requis' }, { status: 400 })
    }

    // Hash du mot de passe
    const hashedPassword = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    })

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        role: role || 'user',
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })

    return NextResponse.json({ data: newUser }, { status: 201 })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'Non authentifié') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message === 'Accès non autorisé') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    // Check for unique constraint violation
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Un utilisateur avec cet email existe déjà' }, { status: 409 })
    }
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
