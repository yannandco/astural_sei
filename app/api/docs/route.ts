import { NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import path from 'path'

interface DocFile {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DocFile[]
}

async function scanDir(dirPath: string, basePath: string): Promise<DocFile[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const results: DocFile[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.relative(basePath, fullPath)

    if (entry.isDirectory()) {
      const children = await scanDir(fullPath, basePath)
      results.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children,
      })
    } else if (entry.name.endsWith('.md')) {
      results.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
      })
    }
  }

  return results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function GET() {
  try {
    const projectRoot = process.cwd()
    const files: DocFile[] = []

    // CHANGELOG.md
    try {
      await stat(path.join(projectRoot, 'CHANGELOG.md'))
      files.push({ name: 'CHANGELOG.md', path: 'CHANGELOG.md', type: 'file' })
    } catch {}

    // .specify/ directory
    try {
      const specifyPath = path.join(projectRoot, '.specify')
      await stat(specifyPath)
      const specifyFiles = await scanDir(specifyPath, projectRoot)
      files.push({
        name: '.specify',
        path: '.specify',
        type: 'directory',
        children: specifyFiles,
      })
    } catch {}

    return NextResponse.json({ data: files })
  } catch (error) {
    console.error('Error listing docs:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
