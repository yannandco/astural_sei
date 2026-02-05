import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireRole, validateRequest } from '@/lib/auth/server'
import { eq } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/users/[id]
export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireRole(['admin'])
    const { id } = await params

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, id))

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: user })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'Non authentifié') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message === 'Accès non autorisé') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH /api/users/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireRole(['admin'])
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email
    if (body.role !== undefined) updateData.role = body.role
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Hash new password if provided
    if (body.password) {
      updateData.password = await hash(body.password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      })
    }

    updateData.updatedAt = new Date()

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })

    if (!updated) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'Non authentifié') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message === 'Accès non autorisé') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Un utilisateur avec cet email existe déjà' }, { status: 409 })
    }
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/users/[id]
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { user } = await validateRequest()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params

    // Prevent self-deletion
    if (user.id === id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 })
    }

    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'Non authentifié') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message === 'Accès non autorisé') {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
