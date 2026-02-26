'use client'

import React, { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'

interface User {
  name: string
  email: string
  role: string
}

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const remplacantNav: NavItem[] = [
  { name: 'Planning', href: '/portail', icon: CalendarDaysIcon },
  { name: 'Remplacements', href: '/portail/remplacements', icon: UserGroupIcon },
  { name: 'Absences', href: '/portail/absences', icon: ExclamationTriangleIcon },
]

const collaborateurNav: NavItem[] = [
  { name: 'Planning', href: '/portail', icon: CalendarDaysIcon },
  { name: 'Absences', href: '/portail/absences', icon: ExclamationTriangleIcon },
]

export default function PortailLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch('/api/auth/get-session')
      .then(res => {
        if (!res.ok) {
          router.push('/login')
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data?.user) {
          if (data.user.role !== 'collaborateur' && data.user.role !== 'remplacant') {
            router.push('/collaborateurs')
            return
          }
          setUser(data.user)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    router.push('/login')
  }

  const navigation = user?.role === 'collaborateur' ? collaborateurNav : remplacantNav
  const espaceLabel = user?.role === 'collaborateur' ? 'Espace Collaborateur' : 'Espace Remplaçant'

  const isActive = (item: NavItem) => {
    if (item.href === '/portail') return pathname === '/portail'
    return pathname.startsWith(item.href)
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
          {/* Logo + title */}
          <div className="flex h-20 items-center justify-between px-6 border-b border-gray-200">
            <Link href="/portail" onClick={() => setSidebarOpen(false)} className="flex flex-col">
              <Image
                src="/Astural-Logotype.svg"
                alt="Astural"
                width={140}
                height={45}
                priority
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
              <span className="text-xs font-medium text-purple-700 mt-1">{espaceLabel}</span>
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
            <div className="space-y-1">
              {navigation.map((item) => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${active
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon
                      className={`
                        mr-3 h-5 w-5 flex-shrink-0 transition-colors
                        ${active ? 'text-purple-700' : 'text-gray-400 group-hover:text-gray-500'}
                      `}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* User info */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
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
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
