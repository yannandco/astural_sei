import { cookies } from 'next/headers'
import { cache } from 'react'
import { lucia } from './lucia'
import type { Session, User } from 'lucia'

export const validateRequest = cache(
  async (): Promise<{ user: User; session: Session } | { user: null; session: null }> => {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null

    if (!sessionId) {
      return { user: null, session: null }
    }

    const result = await lucia.validateSession(sessionId)

    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id)
        cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)
      }
      if (!result.session) {
        const sessionCookie = lucia.createBlankSessionCookie()
        cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)
      }
    } catch {
      // Ignore cookie errors in edge cases
    }

    return result
  }
)

export async function requireAuth() {
  const { user, session } = await validateRequest()
  if (!user || !session) {
    throw new Error('Non authentifié')
  }
  return { user, session }
}

export async function requireRole(allowedRoles: string[]) {
  const { user, session } = await requireAuth()
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Accès non autorisé')
  }
  return { user, session }
}
