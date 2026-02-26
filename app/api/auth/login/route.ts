import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
        { status: 429 }
      )
    }

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

    // Sign in via Better Auth using the user's actual email
    const result = await auth.api.signInEmail({
      body: { email: user.email, password },
      headers: await headers(),
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Identifiants invalides' },
        { status: 401 }
      )
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))

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
    // Better Auth throws on invalid credentials
    if (error instanceof Error && error.message?.includes('Invalid')) {
      return NextResponse.json(
        { error: 'Identifiants invalides' },
        { status: 401 }
      )
    }
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
