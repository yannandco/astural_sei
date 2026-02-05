'use client'

import { useState, useEffect } from 'react'
import { DocumentTextIcon, FolderIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface DocFile {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DocFile[]
}

function FileTree({ items, selectedPath, onSelect, depth = 0 }: { items: DocFile[]; selectedPath: string; onSelect: (path: string) => void; depth?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const defaults: Record<string, boolean> = {}
    items.forEach(item => {
      if (item.type === 'directory') defaults[item.path] = true
    })
    setExpanded(defaults)
  }, [items])

  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <div key={item.path}>
          {item.type === 'directory' ? (
            <>
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [item.path]: !prev[item.path] }))}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
              >
                <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform ${expanded[item.path] ? 'rotate-90' : ''}`} />
                <FolderIcon className="w-4 h-4 text-gray-400" />
                <span>{item.name}</span>
              </button>
              {expanded[item.path] && item.children && (
                <FileTree items={item.children} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
              )}
            </>
          ) : (
            <button
              onClick={() => onSelect(item.path)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
                selectedPath === item.path ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <span className="w-3.5" />
              <DocumentTextIcon className="w-4 h-4 text-gray-400" />
              <span>{item.name}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default function DocumentationPage() {
  const [files, setFiles] = useState<DocFile[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingContent, setLoadingContent] = useState(false)

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch('/api/docs')
        const data = await res.json()
        setFiles(data.data || [])
        if (data.data?.length > 0) {
          const changelog = data.data.find((f: DocFile) => f.name === 'CHANGELOG.md')
          if (changelog) {
            handleSelectFile(changelog.path)
          }
        }
      } catch (error) {
        console.error('Error fetching docs:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchFiles()
  }, [])

  const handleSelectFile = async (filePath: string) => {
    setSelectedPath(filePath)
    setLoadingContent(true)
    try {
      const res = await fetch(`/api/docs/${filePath}`)
      const data = await res.json()
      setContent(data.data?.content || '')
    } catch (error) {
      console.error('Error fetching doc content:', error)
      setContent('Erreur de chargement.')
    } finally {
      setLoadingContent(false)
    }
  }

  if (loading) {
    return (
      <div className="ds-empty-state"><div className="ds-empty-state-content"><div className="spinner-md mx-auto mb-4"></div><p className="text-gray-500">Chargement...</p></div></div>
    )
  }

  return (
    <div>
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper"><DocumentTextIcon className="ds-header-icon" /></div>
            <div>
              <h1 className="ds-header-title">Documentation</h1>
              <p className="ds-header-subtitle">Spécifications et changelog du projet</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <div className="ds-table-container">
          <div className="p-3">
            <FileTree items={files} selectedPath={selectedPath} onSelect={handleSelectFile} />
          </div>
        </div>

        {/* Content */}
        <div className="ds-table-container">
          <div className="p-6">
            {loadingContent ? (
              <div className="flex justify-center py-8"><div className="spinner-md"></div></div>
            ) : content ? (
              <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-a:text-purple-600 prose-strong:text-gray-900 prose-code:text-purple-700 prose-code:bg-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-table:border-collapse prose-th:border prose-th:border-gray-200 prose-th:bg-gray-50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:text-gray-700 prose-td:border prose-td:border-gray-200 prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-li:text-gray-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sélectionnez un fichier dans l'arborescence.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
