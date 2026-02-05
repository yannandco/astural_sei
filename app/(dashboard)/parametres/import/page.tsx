'use client'

import Link from 'next/link'
import {
  ArrowUpTrayIcon,
  UsersIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

interface ImportCard {
  id: string
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  available: boolean
}

const importTypes: ImportCard[] = [
  {
    id: 'collaborateurs',
    title: 'Collaborateurs SEI',
    description: 'Import des collaborateurs depuis un fichier Excel',
    href: '/collaborateurs/import',
    icon: UsersIcon,
    available: true,
  },
  {
    id: 'remplacants',
    title: 'Remplaçants',
    description: 'Import des remplaçants depuis un fichier Excel',
    href: '/remplacants/import',
    icon: UserGroupIcon,
    available: true,
  },
  {
    id: 'disponibilites',
    title: 'Disponibilités remplaçants',
    description: 'Import des disponibilités depuis un fichier Excel',
    href: '/remplacants/import-disponibilites',
    icon: CalendarDaysIcon,
    available: true,
  },
  {
    id: 'etablissements',
    title: 'Établissements',
    description: 'Import des établissements depuis un fichier Excel',
    href: '/etablissements/import',
    icon: BuildingOffice2Icon,
    available: true,
  },
  {
    id: 'classes',
    title: 'Classes',
    description: 'Import des classes depuis un fichier Excel',
    href: '/classes/import',
    icon: AcademicCapIcon,
    available: false,
  },
]

export default function ImportPage() {
  return (
    <div>
      {/* Page Header */}
      <div className="ds-header">
        <div className="ds-header-content">
          <div className="ds-header-left">
            <div className="ds-header-icon-wrapper">
              <ArrowUpTrayIcon className="ds-header-icon" />
            </div>
            <div>
              <h1 className="ds-header-title">Imports</h1>
              <p className="ds-header-subtitle">Sélectionnez le type de données à importer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Import Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {importTypes.map((item) => (
          <div key={item.id} className="relative">
            {item.available ? (
              <Link
                href={item.href}
                className="block ds-table-container p-5 hover:shadow-md hover:border-purple-200 transition-all group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-3 group-hover:bg-purple-200 transition-colors">
                    <item.icon className="w-6 h-6 text-purple-700" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              </Link>
            ) : (
              <div className="ds-table-container p-5 opacity-60 cursor-not-allowed">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <item.icon className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500">{item.description}</p>
                  <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    Bientôt
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
