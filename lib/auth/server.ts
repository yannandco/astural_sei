import { headers } from 'next/headers'
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collaborateurs, remplacants } from '@/lib/db/schema'
import { auth } from '.'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'collaborateur' | 'remplacant'
  isActive: boolean
}

export type AuthSession = {
  id: string
  userId: string
  token: string
  expiresAt: Date
}

export const validateRequest = cache(
  async (): Promise<
    { user: AuthUser; session: AuthSession } | { user: null; session: null }
  > => {
    const session = await auth.api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    })

    if (!session) {
      return { user: null, session: null }
    }

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: ((session.user as Record<string, unknown>).role as AuthUser['role']) || 'user',
        isActive: (session.user as Record<string, unknown>).isActive as boolean ?? true,
      },
      session: {
        id: session.session.id,
        userId: session.session.userId,
        token: session.session.token,
        expiresAt: session.session.expiresAt,
      },
    }
  }
)

export async function requireAuth() {
  const { user, session } = await validateRequest()
  if (!user || !session) {
    throw new Error('Non authentifié')
  }
  if (!user.isActive) {
    throw new Error('Compte désactivé')
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

export async function requireAdminOrSelfCollaborateur(collaborateurId: number) {
  const { user, session } = await requireAuth()

  // Admin or regular user can manage any collaborateur
  if (user.role === 'admin' || user.role === 'user') {
    return { user, session }
  }

  // Self-service: collaborateur managing their own data
  if (user.role === 'collaborateur') {
    const [collab] = await db
      .select({ id: collaborateurs.id })
      .from(collaborateurs)
      .where(eq(collaborateurs.userId, user.id))
      .limit(1)

    if (collab && collab.id === collaborateurId) {
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
