import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { whatsappMessages, remplacants } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'user'])

    const { searchParams } = new URL(request.url)
    const absenceId = searchParams.get('absenceId')

    if (!absenceId) {
      return NextResponse.json({ error: 'absenceId requis' }, { status: 400 })
    }

    const messages = await db
      .select({
        id: whatsappMessages.id,
        remplacantId: whatsappMessages.remplacantId,
        phone: whatsappMessages.phone,
        status: whatsappMessages.status,
        response: whatsappMessages.response,
        respondedAt: whatsappMessages.respondedAt,
        createdAt: whatsappMessages.createdAt,
        remplacantFirstName: remplacants.firstName,
        remplacantLastName: remplacants.lastName,
      })
      .from(whatsappMessages)
      .leftJoin(remplacants, eq(whatsappMessages.remplacantId, remplacants.id))
      .where(eq(whatsappMessages.absenceId, parseInt(absenceId)))
      .orderBy(desc(whatsappMessages.createdAt))

    return NextResponse.json({ data: messages })
  } catch (error) {
    console.error('Error fetching WhatsApp responses:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
