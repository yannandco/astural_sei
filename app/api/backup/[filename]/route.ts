import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/server'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const BACKUP_DIR = path.join(process.cwd(), 'backups')

const FILENAME_REGEX = /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(_[a-zA-Z0-9_-]+)?\.sql(\.gz)?$/

type RouteParams = { params: Promise<{ filename: string }> }

const ALLOWED_PG_BINARIES = ['pg_dump', 'psql']

// Find PostgreSQL binaries
async function findPgBinary(name: string): Promise<string> {
  if (!ALLOWED_PG_BINARIES.includes(name)) {
    throw new Error('Binaire non autorisé')
  }

  const possiblePaths = [
    `/opt/homebrew/bin/${name}`,
    `/opt/homebrew/opt/postgresql@16/bin/${name}`,
    `/opt/homebrew/opt/postgresql@15/bin/${name}`,
    `/opt/homebrew/opt/postgresql/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/local/opt/postgresql@16/bin/${name}`,
    `/usr/local/opt/postgresql@15/bin/${name}`,
    `/usr/local/opt/postgresql/bin/${name}`,
    `/usr/bin/${name}`,
  ]

  // Also check Homebrew Cellar using execFile (no shell injection)
  try {
    const { stdout } = await execFileAsync('find', [
      '/opt/homebrew/Cellar', '-name', name, '-type', 'f',
    ], { timeout: 5000 })
    const firstLine = stdout.trim().split('\n')[0]
    if (firstLine) {
      possiblePaths.unshift(firstLine)
    }
  } catch {
    // Ignore errors
  }

  for (const p of possiblePaths) {
    try {
      await fs.access(p, fs.constants.X_OK)
      return p
    } catch {
      // Continue to next path
    }
  }

  throw new Error(`${name} non trouvé. Installez PostgreSQL ou vérifiez le PATH.`)
}

// Parse DATABASE_URL to get connection params
function parseDbUrl(url: string) {
  const match = url.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) throw new Error('Invalid DATABASE_URL format')
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5].split('?')[0],
  }
}

// GET - Download a backup file
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { filename } = await params

    // Strict filename validation
    if (!FILENAME_REGEX.test(filename)) {
      return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 })
    }

    const filepath = path.join(BACKUP_DIR, filename)

    // Check if file exists
    try {
      await fs.access(filepath)
    } catch {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    const fileBuffer = await fs.readFile(filepath)
    const stats = await fs.stat(filepath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading backup:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Restore a backup
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { filename } = await params

    // Strict filename validation
    if (!FILENAME_REGEX.test(filename)) {
      return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 })
    }

    const filepath = path.join(BACKUP_DIR, filename)

    // Check if file exists
    try {
      await fs.access(filepath)
    } catch {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return NextResponse.json({ error: 'DATABASE_URL non configurée' }, { status: 500 })
    }

    const db = parseDbUrl(dbUrl)
    const isCompressed = filename.endsWith('.gz')

    // Find psql binary
    const psqlPath = await findPgBinary('psql')

    const pgEnv = { ...process.env, PGPASSWORD: db.password }

    // First, drop all tables to ensure clean restore
    console.log('Dropping all tables...')
    try {
      await execFileAsync(psqlPath, [
        '-h', db.host,
        '-p', db.port,
        '-U', db.user,
        '-d', db.database,
        '-c', `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${db.user};`,
      ], { env: pgEnv })
      console.log('Tables dropped successfully')
    } catch (dropError) {
      console.error('Error dropping tables:', dropError)
      // Continue anyway, the restore might still work
    }

    // Build restore command
    console.log('Executing restore command...')
    try {
      if (isCompressed) {
        // For compressed files, we need a shell pipe but pass PGPASSWORD via env
        const restoreCmd = `gunzip -c "${filepath}" | "${psqlPath}" -v ON_ERROR_STOP=1 -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database}`
        await execAsync(restoreCmd, { shell: '/bin/bash', maxBuffer: 50 * 1024 * 1024, env: pgEnv })
      } else {
        // Non-compressed: use execFile (no shell)
        await execFileAsync(psqlPath, [
          '-v', 'ON_ERROR_STOP=1',
          '-h', db.host,
          '-p', db.port,
          '-U', db.user,
          '-d', db.database,
          '-f', filepath,
        ], { maxBuffer: 50 * 1024 * 1024, env: pgEnv })
      }
    } catch (restoreError) {
      console.error('Restore error:', restoreError)
      return NextResponse.json({ error: 'Erreur lors de la restauration' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Restauration effectuée avec succès' })
  } catch (error) {
    console.error('Error restoring backup:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur lors de la restauration' }, { status: 500 })
  }
}

// DELETE - Delete a backup file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(['admin'])

    const { filename } = await params

    // Strict filename validation
    if (!FILENAME_REGEX.test(filename)) {
      return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 })
    }

    const filepath = path.join(BACKUP_DIR, filename)

    // Check if file exists
    try {
      await fs.access(filepath)
    } catch {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    await fs.unlink(filepath)

    return NextResponse.json({ message: 'Sauvegarde supprimée' })
  } catch (error) {
    console.error('Error deleting backup:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié' || (error as Error).message === 'Compte désactivé') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
