import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { lucia } from '@/lib/auth/lucia'
import { validateRequest } from '@/lib/auth/server'

export async function POST() {
  try {
    const { session } = await validateRequest()

    if (session) {
      await lucia.invalidateSession(session.id)
    }

    const sessionCookie = lucia.createBlankSessionCookie()
    const cookieStore = await cookies()
    cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
