import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verify } from '@node-rs/argon2'
import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { lucia } from '@/lib/auth/lucia'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    // Find user by email or username
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.name, email)))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: 'Identifiants invalides' },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Compte désactivé' },
        { status: 401 }
      )
    }

    // Verify password
    const validPassword = await verify(user.password, password)
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Identifiants invalides' },
        { status: 401 }
      )
    }

    // Create session
    const session = await lucia.createSession(user.id, {})
    const sessionCookie = lucia.createSessionCookie(session.id)

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))

    const cookieStore = await cookies()
    cookieStore.set(sessionCookie.name, sessionCookie.value, {
      ...sessionCookie.attributes,
      httpOnly: true,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
