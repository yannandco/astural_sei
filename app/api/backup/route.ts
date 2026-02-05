import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

const BACKUP_DIR = path.join(process.cwd(), 'backups')

// Find PostgreSQL binaries
async function findPgBinary(name: string): Promise<string> {
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

  // Also check Homebrew Cellar
  try {
    const { stdout } = await execAsync('find /opt/homebrew/Cellar -name "' + name + '" -type f 2>/dev/null | head -1', { shell: '/bin/bash' })
    if (stdout.trim()) {
      possiblePaths.unshift(stdout.trim())
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

// Ensure backup directory exists
async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
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

// GET - List all backups
export async function GET() {
  try {
    await requireRole(['admin'])
    await ensureBackupDir()

    const files = await fs.readdir(BACKUP_DIR)
    const backups = await Promise.all(
      files
        .filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))
        .map(async (filename) => {
          const filepath = path.join(BACKUP_DIR, filename)
          const stats = await fs.stat(filepath)

          // Parse filename: backup_YYYY-MM-DD_HH-MM-SS_name.sql
          const match = filename.match(/^backup_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_?(.*)\.sql(\.gz)?$/)

          return {
            filename,
            date: match ? `${match[1]} ${match[2].replace(/-/g, ':')}` : stats.mtime.toISOString(),
            name: match?.[3] || '',
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            compressed: filename.endsWith('.gz'),
            createdAt: stats.mtime.toISOString(),
          }
        })
    )

    // Sort by date descending
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ data: backups })
  } catch (error) {
    console.error('Error listing backups:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create a new backup
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])
    await ensureBackupDir()

    const body = await request.json().catch(() => ({}))
    const name = (body.name || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
    const compress = body.compress !== false

    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return NextResponse.json({ error: 'DATABASE_URL non configurée' }, { status: 500 })
    }

    const db = parseDbUrl(dbUrl)

    // Generate filename
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-')
    const filename = `backup_${dateStr}_${timeStr}${name ? '_' + name : ''}.sql${compress ? '.gz' : ''}`
    const filepath = path.join(BACKUP_DIR, filename)

    // Find pg_dump binary
    const pgDumpPath = await findPgBinary('pg_dump')

    // Build pg_dump command with proper flags for clean restore:
    // --clean: output commands to DROP objects before recreating
    // --if-exists: use IF EXISTS when dropping
    // --no-owner: don't output ownership commands
    // --no-privileges: don't output privilege commands (GRANT/REVOKE)
    const dumpFlags = `--clean --if-exists --no-owner --no-privileges`

    // Use set -o pipefail to catch errors in piped commands
    const pgDumpCmd = compress
      ? `set -o pipefail && PGPASSWORD="${db.password}" "${pgDumpPath}" -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} ${dumpFlags} | gzip > "${filepath}"`
      : `PGPASSWORD="${db.password}" "${pgDumpPath}" -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} ${dumpFlags} -f "${filepath}"`

    console.log('Running pg_dump with path:', pgDumpPath)

    try {
      const { stdout, stderr } = await execAsync(pgDumpCmd, { shell: '/bin/bash', maxBuffer: 50 * 1024 * 1024 })
      if (stderr) {
        console.error('pg_dump stderr:', stderr)
      }
      if (stdout) {
        console.log('pg_dump stdout:', stdout)
      }
    } catch (execError: unknown) {
      const err = execError as { stderr?: string; message?: string }
      console.error('pg_dump error:', err)
      // Clean up empty file if created
      try {
        await fs.unlink(filepath)
      } catch {}
      return NextResponse.json({
        error: `Erreur pg_dump: ${err.stderr || err.message || 'Erreur inconnue'}`
      }, { status: 500 })
    }

    // Get file stats and verify backup is not empty
    const stats = await fs.stat(filepath)

    // A valid backup should be at least 1KB (even a small DB produces more than that)
    if (stats.size < 1000) {
      console.error('Backup file too small:', stats.size, 'bytes')
      // Clean up invalid backup
      try {
        await fs.unlink(filepath)
      } catch {}
      return NextResponse.json({
        error: `La sauvegarde a échoué (fichier trop petit: ${stats.size} bytes). Vérifiez la connexion à la base de données.`
      }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        filename,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        createdAt: stats.mtime.toISOString(),
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating backup:', error)
    if ((error as Error).message === 'Accès non autorisé') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    if ((error as Error).message === 'Non authentifié') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: `Erreur lors de la sauvegarde: ${(error as Error).message}` }, { status: 500 })
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
