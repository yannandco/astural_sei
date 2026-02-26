import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { whatsappMessages } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import twilio from 'twilio'

// Twilio sends webhook as POST with form-urlencoded body
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    // Validate Twilio signature
    const signature = request.headers.get('x-twilio-signature') || ''
    const params = Object.fromEntries(formData.entries()) as Record<string, string>
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (authToken) {
      const isValid = twilio.validateRequest(authToken, signature, request.url, params)
      if (!isValid) {
        return new NextResponse('<Response></Response>', {
          status: 403,
          headers: { 'Content-Type': 'text/xml' },
        })
      }
    }

    const from = formData.get('From')?.toString() || ''     // whatsapp:+41791234567
    const body = formData.get('Body')?.toString()?.trim() || ''

    // Extract phone number from "whatsapp:+41791234567"
    const phoneMatch = from.match(/whatsapp:\+(\d+)/)
    if (!phoneMatch) {
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    const phone = phoneMatch[1]

    // Find the most recent message sent to this phone number that hasn't been answered yet
    const [latestMessage] = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.phone, phone))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(1)

    if (!latestMessage) {
      // No message found for this phone — ignore
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Already answered — ignore
    if (latestMessage.response) {
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Parse response from Quick Reply buttons or text
    // Button clicks send the button text: "Oui" or "Non"
    // Also support: "1"/"2", "disponible"/"pas disponible", "oui"/"non"
    const lower = body.toLowerCase()
    let response: 'disponible' | 'pas_disponible' | null = null
    let replyMessage = ''

    if (lower === 'oui' || lower === '1' || lower === 'disponible' || (lower.includes('disponible') && !lower.includes('pas') && !lower.includes('indisponible'))) {
      response = 'disponible'
      replyMessage = 'Merci ! Votre disponibilité a été enregistrée. ✅'
    } else if (lower === 'non' || lower === '2' || lower === 'pas disponible' || lower === 'indisponible' || lower.includes('pas disponible') || lower.includes('indisponible')) {
      response = 'pas_disponible'
      replyMessage = 'Merci pour votre retour. Votre indisponibilité a été enregistrée.'
    } else {
      // Unrecognized response
      replyMessage = 'Merci pour votre message. Merci de répondre Oui ou Non pour confirmer votre disponibilité.'
    }

    // Update the message in database if we got a valid response
    if (response) {
      await db
        .update(whatsappMessages)
        .set({
          response,
          respondedAt: new Date(),
        })
        .where(eq(whatsappMessages.id, latestMessage.id))
    }

    // Send auto-reply via TwiML
    const twiml = `<Response><Message>${escapeXml(replyMessage)}</Message></Response>`

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
