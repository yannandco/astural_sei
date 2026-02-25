import { cookies } from 'next/headers'
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collaborateurs, remplacants } from '@/lib/db/schema'
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

export async function requirePortailAuth() {
  const { user, session } = await requireAuth()
  if (user.role !== 'collaborateur' && user.role !== 'remplacant') {
    throw new Error('Accès non autorisé')
  }
  return { user, session }
}

export async function requireAdminOrSelfRemplacant(remplacantId: number) {
  const { user, session } = await requireAuth()

  // Admin or regular user can manage any remplaçant
  if (user.role === 'admin' || user.role === 'user') {
    return { user, session }
  }

  // Self-service: remplaçant managing their own data
  if (user.role === 'remplacant') {
    const [remp] = await db
      .select({ id: remplacants.id })
      .from(remplacants)
      .where(eq(remplacants.userId, user.id))
      .limit(1)

    if (remp && remp.id === remplacantId) {
      return { user, session }
    }
  }

  throw new Error('Accès non autorisé')
}

export async function getPortailUser() {
  const { user, session } = await requirePortailAuth()

  if (user.role === 'collaborateur') {
    const [collab] = await db
      .select()
      .from(collaborateurs)
      .where(eq(collaborateurs.userId, user.id))
      .limit(1)
    if (!collab) throw new Error('Collaborateur non trouvé')
    return { user, session, role: 'collaborateur' as const, collaborateur: collab, remplacant: null }
  }

  const [remp] = await db
    .select()
    .from(remplacants)
    .where(eq(remplacants.userId, user.id))
    .limit(1)
  if (!remp) throw new Error('Remplaçant non trouvé')
  return { user, session, role: 'remplacant' as const, collaborateur: null, remplacant: remp }
}
