import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { whatsappMessages } from '@/lib/db/schema'

interface JourPresence {
  jour: string
  creneau: string
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const body = await request.json()
    const { recipients, absenceId, dateDebut, dateFin, creneau, collaborateurName, ecoleName, joursPresence } = body as {
      recipients: { phone: string; name: string; remplacantId: number }[]
      absenceId: number
      dateDebut: string
      dateFin: string
      creneau: string
      collaborateurName?: string
      ecoleName?: string
      joursPresence?: JourPresence[] | null
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Aucun destinataire' }, { status: 400 })
    }
    if (!absenceId) {
      return NextResponse.json({ error: 'ID absence requis' }, { status: 400 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM
    const contentSid = process.env.TWILIO_CONTENT_SID

    if (!accountSid || !authToken || !fromNumber || !contentSid) {
      return NextResponse.json({ error: 'Configuration Twilio manquante' }, { status: 500 })
    }

    // Generate schedule text (day-by-day) or fallback to simple format
    const scheduleText = generateScheduleText(dateDebut, dateFin, creneau, joursPresence || null)
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    // Build template message for DB storage
    const templateMessage = collaborateurName && ecoleName
      ? `Bonjour, nous recherchons un remplaçant pour ${collaborateurName} à l'école ${ecoleName}.\nHoraires :\n${scheduleText}\nÊtes-vous disponible ?`
      : `Bonjour, nous recherchons un remplaçant pour une absence du ${fmtDate(dateDebut)} au ${fmtDate(dateFin)} (${creneau}). Êtes-vous disponible ?`

    const results: { phone: string; name: string; remplacantId: number; success: boolean; error?: string }[] = []

    for (const recipient of recipients) {
      const toNumber = formatPhoneForWhatsApp(recipient.phone)
      if (!toNumber) {
        results.push({ phone: recipient.phone, name: recipient.name, remplacantId: recipient.remplacantId, success: false, error: 'Numéro invalide' })
        continue
      }

      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

        const params = new URLSearchParams()
        params.append('To', `whatsapp:+${toNumber}`)
        params.append('From', `whatsapp:${fromNumber}`)
        params.append('ContentSid', contentSid)

        // Use enriched variables if available, otherwise fallback
        if (collaborateurName && ecoleName) {
          params.append('ContentVariables', JSON.stringify({
            '1': collaborateurName,
            '2': ecoleName,
            '3': scheduleText,
          }))
        } else {
          params.append('ContentVariables', JSON.stringify({
            '1': fmtDate(dateDebut),
            '2': fmtDate(dateFin),
            '3': creneau,
          }))
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })

        if (res.ok) {
          const twilioData = await res.json()

          // Save to database
          await db.insert(whatsappMessages).values({
            absenceId,
            remplacantId: recipient.remplacantId,
            phone: toNumber,
            message: templateMessage,
            twilioSid: twilioData.sid || null,
            status: 'sent',
            createdBy: user.id,
          })

          results.push({ phone: recipient.phone, name: recipient.name, remplacantId: recipient.remplacantId, success: true })
        } else {
          const errorData = await res.json()
          results.push({
            phone: recipient.phone,
            name: recipient.name,
            remplacantId: recipient.remplacantId,
            success: false,
            error: errorData.message || `Erreur ${res.status}`,
          })
        }
      } catch (err) {
        results.push({
          phone: recipient.phone,
          name: recipient.name,
          remplacantId: recipient.remplacantId,
          success: false,
          error: (err as Error).message,
        })
      }
    }

    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({ data: { results, sent, failed } })
  } catch (error) {
    console.error('Error sending WhatsApp messages:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function formatPhoneForWhatsApp(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (!cleaned) return null

  // Explicit French: 0033... or +33...
  if (cleaned.startsWith('0033')) return '33' + cleaned.slice(4)
  if (cleaned.startsWith('+33')) return '33' + cleaned.slice(3)
  // Swiss +41
  if (cleaned.startsWith('+41')) return '41' + cleaned.slice(3)
  // Already international
  if (cleaned.startsWith('41') && cleaned.length >= 11) return cleaned
  if (cleaned.startsWith('33') && cleaned.length >= 11) return cleaned
  // Default: Swiss (0 → 41)
  if (cleaned.startsWith('0') && cleaned.length === 10) return '41' + cleaned.slice(1)

  return cleaned.replace(/^\+/, '')
}

function generateScheduleText(
  dateDebut: string,
  dateFin: string,
  defaultCreneau: string,
  joursPresence: JourPresence[] | null
): string {
  const jourNamesByDow: Record<number, string> = {
    1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi',
  }
  const jourAbrev: Record<string, string> = {
    lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven',
  }
  const creneauLabels: Record<string, string> = {
    matin: 'Matin', apres_midi: 'Après-midi', journee: 'Journée',
    Matin: 'Matin', 'Après-midi': 'Après-midi', 'Journée': 'Journée',
  }

  const start = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  const lines: string[] = []

  // Build a lookup: jour name → créneau
  const jourCreneauMap: Record<string, string> = {}
  if (joursPresence && joursPresence.length > 0) {
    for (const jp of joursPresence) {
      const existing = jourCreneauMap[jp.jour]
      if (existing) {
        // If both matin and apres_midi exist, combine to journee
        if ((existing === 'matin' && jp.creneau === 'apres_midi') ||
            (existing === 'apres_midi' && jp.creneau === 'matin')) {
          jourCreneauMap[jp.jour] = 'journee'
        }
      } else {
        jourCreneauMap[jp.jour] = jp.creneau
      }
    }
  }

  const current = new Date(start)
  while (current <= end) {
    const dayOfWeek = current.getDay() // 0=Sun, 1=Mon, ...
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // weekday
      const jourName = jourNamesByDow[dayOfWeek]
      let creneau: string | null = null

      if (joursPresence && joursPresence.length > 0) {
        creneau = jourCreneauMap[jourName] || null
      } else {
        // No joursPresence data — use default créneau for all weekdays
        creneau = defaultCreneau
      }

      if (creneau) {
        const dateStr = current.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        lines.push(`${jourAbrev[jourName]} ${dateStr}: ${creneauLabels[creneau] || creneau}`)
      }
    }
    current.setDate(current.getDate() + 1)
  }

  return lines.join('\n')
}
