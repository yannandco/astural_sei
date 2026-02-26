import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'
import { db } from '@/lib/db'
import { users, collaborateurs, account } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/server'
import crypto from 'crypto'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Vérifier l'accès portail d'un collaborateur
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [collab] = await db
      .select({ userId: collaborateurs.userId })
      .from(collaborateurs)
      .where(eq(collaborateurs.id, collaborateurId))
      .limit(1)

    if (!collab) {
      return NextResponse.json({ error: 'Collaborateur non trouvé' }, { status: 404 })
    }

    if (!collab.userId) {
      return NextResponse.json({ data: { hasAccess: false } })
    }

    const [user] = await db
      .select({ email: users.email, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, collab.userId))
      .limit(1)

    return NextResponse.json({
      data: { hasAccess: true, email: user?.email, isActive: user?.isActive },
    })
  } catch (error) {
    console.error('Error checking collaborateur access:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer un accès portail pour un collaborateur
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    // Vérifier que le collaborateur existe
    const [collab] = await db
      .select()
      .from(collaborateurs)
      .where(eq(collaborateurs.id, collaborateurId))
      .limit(1)

    if (!collab) {
      return NextResponse.json({ error: 'Collaborateur non trouvé' }, { status: 404 })
    }

    if (collab.userId) {
      return NextResponse.json({ error: 'Ce collaborateur a déjà un accès portail' }, { status: 400 })
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit faire au moins 6 caractères' }, { status: 400 })
    }

    // Vérifier que l'email n'est pas déjà utilisé
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 400 })
    }

    // Créer le user
    const hashedPassword = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    })
    const name = `${collab.firstName} ${collab.lastName}`

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        emailVerified: true,
        role: 'collaborateur',
        isActive: true,
      })
      .returning()

    // Create credential account entry
    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: newUser.id,
      accountId: newUser.id,
      providerId: 'credential',
      password: hashedPassword,
    })

    // Lier au collaborateur
    await db
      .update(collaborateurs)
      .set({ userId: newUser.id, updatedAt: new Date() })
      .where(eq(collaborateurs.id, collaborateurId))

    return NextResponse.json({
      data: { userId: newUser.id, email: newUser.email },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating collaborateur access:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Retirer l'accès portail d'un collaborateur
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { id } = await params
    const collaborateurId = parseInt(id)

    if (isNaN(collaborateurId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [collab] = await db
      .select()
      .from(collaborateurs)
      .where(eq(collaborateurs.id, collaborateurId))
      .limit(1)

    if (!collab) {
      return NextResponse.json({ error: 'Collaborateur non trouvé' }, { status: 404 })
    }

    if (!collab.userId) {
      return NextResponse.json({ error: 'Ce collaborateur n\'a pas d\'accès portail' }, { status: 400 })
    }

    // Désactiver le user
    await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, collab.userId))

    // Dissocier le user
    await db
      .update(collaborateurs)
      .set({ userId: null, updatedAt: new Date() })
      .where(eq(collaborateurs.id, collaborateurId))

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('Error removing collaborateur access:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
