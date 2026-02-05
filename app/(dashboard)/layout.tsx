'use client'

import React, { ReactNode, useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UsersIcon,
  UserGroupIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  HomeIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  UserIcon,
  AcademicCapIcon,
  ArrowUpTrayIcon,
  SwatchIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'

type NavSubItem = { id: string; name: string; href: string; icon: React.ComponentType<{ className?: string }> }
type NavItem = { id: string; name: string; href: string; icon: React.ComponentType<{ className?: string }>; children?: NavSubItem[] }
type NavSection = { label: string; items: NavItem[] }

const navigationSections: NavSection[] = [
  {
    label: 'SEI',
    items: [
      { id: 'collaborateurs', name: 'Collaborateurs', href: '/collaborateurs', icon: UsersIcon },
      { id: 'remplacants', name: 'Remplaçants', href: '/remplacants', icon: UserGroupIcon },
      { id: 'planning', name: 'Planning', href: '/planning', icon: CalendarDaysIcon },
    ],
  },
  {
    label: 'Établissements',
    items: [
      { id: 'etablissements', name: 'Établissements', href: '/etablissements', icon: BuildingOffice2Icon },
      { id: 'ecoles', name: 'Écoles', href: '/ecoles', icon: AcademicCapIcon },
      { id: 'directeurs', name: 'Directeurs', href: '/directeurs', icon: UserIcon },
      { id: 'titulaires', name: 'Titulaires', href: '/titulaires', icon: UserIcon },
    ],
  },
  {
    label: 'Système',
    items: [
      {
        id: 'parametres',
        name: 'Paramètres',
        href: '/parametres',
        icon: Cog6ToothIcon,
        children: [
          { id: 'periodes', name: 'Périodes scolaires', href: '/parametres/periodes', icon: CalendarDaysIcon },
          { id: 'secteurs', name: 'Secteurs', href: '/parametres/secteurs', icon: SwatchIcon },
          { id: 'utilisateurs', name: 'Utilisateurs', href: '/parametres/utilisateurs', icon: UsersIcon },
          { id: 'import', name: 'Imports', href: '/parametres/import', icon: ArrowUpTrayIcon },
          { id: 'backup', name: 'Sauvegardes', href: '/parametres/backup', icon: ServerStackIcon },
          { id: 'systeme', name: 'Maintenance', href: '/parametres/systeme', icon: ExclamationTriangleIcon },
        ],
      },
      { id: 'documentation', name: 'Documentation', href: '/documentation', icon: DocumentTextIcon },
    ],
  },
]

function generateBreadcrumb(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return []
  }

  const breadcrumbs = [{ label: 'Accueil', href: '/collaborateurs' }]

  const routeLabels: Record<string, string> = {
    'parametres': 'Paramètres',
    'periodes': 'Périodes scolaires',
    'secteurs': 'Secteurs',
    'utilisateurs': 'Utilisateurs',
    'systeme': 'Maintenance',
    'import': 'Imports',
    'contacts': 'Contacts',
    'collaborateurs': 'Collaborateurs',
    'remplacants': 'Remplaçants',
    'etablissements': 'Établissements',
    'ecoles': 'Écoles',
    'directeurs': 'Directeurs',
    'titulaires': 'Titulaires',
    'documentation': 'Documentation',
    'planning': 'Planning',
  }

  let currentPath = ''
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`

    if (/^\d+$/.test(segment)) {
      return
    }

    const label = routeLabels[segment] || segment
    breadcrumbs.push({
      label,
      href: currentPath,
    })
  })

  return breadcrumbs
}

interface User {
  name: string
  email: string
  role: string
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  const breadcrumbs = useMemo(() => generateBreadcrumb(pathname), [pathname])

  // Auto-expand menu if we're on a child page
  useEffect(() => {
    navigationSections.forEach(section => {
      section.items.forEach(item => {
        if (item.children && pathname.startsWith(item.href)) {
          setExpandedMenus(prev => ({ ...prev, [item.id]: true }))
        }
      })
    })
  }, [pathname])

  const toggleMenu = (itemId: string) => {
    setExpandedMenus(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          router.push('/login')
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => router.push('/login'))
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center justify-between px-6 border-b border-gray-200">
            <Link href="/collaborateurs" onClick={() => setSidebarOpen(false)} className="flex items-center">
              <Image
                src="/Astural-Logotype.svg"
                alt="Astural"
                width={140}
                height={45}
                priority
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {navigationSections.map((section, sectionIndex) => (
              <div key={section.label} className={sectionIndex > 0 ? 'mt-6' : ''}>
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    const hasChildren = item.children && item.children.length > 0
                    const isExpanded = expandedMenus[item.id]
                    return (
                      <div key={item.id}>
                        {hasChildren ? (
                          <button
                            onClick={() => toggleMenu(item.id)}
                            className={`
                              w-full group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors
                              ${isActive
                                ? 'bg-purple-50 text-purple-700'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                              }
                            `}
                          >
                            <span className="flex items-center">
                              <item.icon
                                className={`
                                  mr-3 h-5 w-5 flex-shrink-0 transition-colors
                                  ${isActive ? 'text-purple-700' : 'text-gray-400 group-hover:text-gray-500'}
                                `}
                              />
                              {item.name}
                            </span>
                            {isExpanded ? (
                              <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`
                              group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                              ${isActive
                                ? 'bg-purple-50 text-purple-700'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                              }
                            `}
                          >
                            <item.icon
                              className={`
                                mr-3 h-5 w-5 flex-shrink-0 transition-colors
                                ${isActive ? 'text-purple-700' : 'text-gray-400 group-hover:text-gray-500'}
                              `}
                            />
                            {item.name}
                          </Link>
                        )}
                        {hasChildren && isExpanded && (
                          <div className="ml-8 mt-1 space-y-1">
                            {item.children!.map((child) => {
                              const isChildActive = pathname === child.href
                              return (
                                <Link
                                  key={child.id}
                                  href={child.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={`
                                    group flex items-center px-3 py-1.5 text-sm rounded-md transition-colors
                                    ${isChildActive
                                      ? 'text-purple-700 font-medium'
                                      : 'text-gray-600 hover:text-gray-900'
                                    }
                                  `}
                                >
                                  <child.icon
                                    className={`
                                      mr-2 h-4 w-4 flex-shrink-0 transition-colors
                                      ${isChildActive ? 'text-purple-700' : 'text-gray-400 group-hover:text-gray-500'}
                                    `}
                                  />
                                  {child.name}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User info */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <p className="text-xs text-purple-600 font-medium">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Déconnexion"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile menu button */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-lg shadow-md"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        <main className="ds-main-content">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            {/* Breadcrumb */}
            <nav className="breadcrumb">
              {breadcrumbs && breadcrumbs.length > 0 ? (
                breadcrumbs.map((crumb, index) => (
                  <div key={`breadcrumb-${crumb.label}-${index}`} className="breadcrumb-container">
                    {index === 0 ? (
                      <HomeIcon className="breadcrumb-icon" />
                    ) : (
                      <ChevronRightIcon className="breadcrumb-separator" />
                    )}
                    <div className={`breadcrumb-item ${!crumb.href ? 'breadcrumb-current' : ''}`}>
                      {crumb.href && index > 0 ? (
                        <Link href={crumb.href}>{crumb.label}</Link>
                      ) : (
                        index > 0 ? crumb.label : null
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div>Navigation</div>
              )}
            </nav>

            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
