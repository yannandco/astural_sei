import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { whatsappMessages } from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const { id } = await params
    const messageId = parseInt(id)

    if (isNaN(messageId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(whatsappMessages)
      .where(eq(whatsappMessages.id, messageId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: { id: messageId } })
  } catch (error) {
    console.error('Error deleting WhatsApp message:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
