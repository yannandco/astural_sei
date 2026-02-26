import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { requireAuth } from '@/lib/auth/server'

type RouteParams = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()
    const { path: segments } = await params
    const filePath = segments.join('/')

    // Security: only allow .md files within project root
    if (!filePath.endsWith('.md')) {
      return NextResponse.json({ error: 'Seuls les fichiers Markdown sont autorisés' }, { status: 400 })
    }

    // Prevent path traversal
    const resolved = path.resolve(process.cwd(), filePath)
    if (!resolved.startsWith(process.cwd())) {
      return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 })
    }

    // Only allow CHANGELOG.md and .specify/ files
    const relative = path.relative(process.cwd(), resolved)
    if (relative !== 'CHANGELOG.md' && !relative.startsWith('.specify/') && !relative.startsWith('.specify\\')) {
      return NextResponse.json({ error: 'Fichier non autorisé' }, { status: 403 })
    }

    const content = await readFile(resolved, 'utf-8')
    return NextResponse.json({ data: { path: filePath, content } })
  } catch (error) {
    console.error('Error reading doc:', error)
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
