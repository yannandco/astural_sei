'use client'

export default function PlanningLegend({ greenLabel = 'Disponible', showAbsences = false }: { greenLabel?: string; showAbsences?: boolean }) {
  const items = [
    { color: 'bg-green-100 border-green-300', label: greenLabel },
    { color: 'bg-purple-100 border-purple-300', label: 'Remplacement' },
    { color: 'bg-red-100 border-red-300', label: 'Exception' },
    { color: 'bg-amber-100 border-amber-300', label: 'Vacances' },
  ]

  if (showAbsences) {
    items.push(
      { color: 'bg-red-200 border-red-400', label: 'Absent (non remplacé)' },
      { color: 'bg-orange-100 border-orange-300', label: 'Absent (remplacé)' },
    )
  }

  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-600">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded border ${item.color}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
