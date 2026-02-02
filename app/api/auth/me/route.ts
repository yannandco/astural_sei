import { NextResponse } from 'next/server'
import { validateRequest } from '@/lib/auth/server'

export async function GET() {
  try {
    const { user, session } = await validateRequest()

    if (!user || !session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
