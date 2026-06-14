import type { PilarStat } from '@/types'

// Gráfico de barras horizontales construido con Tailwind puro (sin librerías externas).
// Recibe los datos ya calculados desde el Server Page.
export default function PillarChart({ data }: { data: PilarStat[] }) {
  const maxValue = Math.max(...data.map(d => d.completadas), 1)

  // Paleta de colores rotativa para las barras
  const BAR_COLORS = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-orange-500',
    'bg-teal-500',
  ]

  if (data.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">Sin datos de tareas completadas aún.</p>
  }

  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const widthPct = Math.max((item.completadas / maxValue) * 100, 4)
        const barColor = BAR_COLORS[idx % BAR_COLORS.length]

        return (
          <div key={item.pilar} className="flex items-center gap-3">
            {/* Etiqueta del pilar */}
            <span className="w-32 text-sm text-gray-600 text-right leading-tight flex-shrink-0">
              {item.pilar}
            </span>

            {/* Barra */}
            <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
              <div
                className={`${barColor} h-7 rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                style={{ width: `${widthPct}%` }}
              >
                {widthPct > 20 && (
                  <span className="text-white text-xs font-bold">{item.completadas}</span>
                )}
              </div>
            </div>

            {/* Valor numérico fuera de la barra */}
            <span className="w-6 text-sm font-semibold text-gray-700 flex-shrink-0">
              {widthPct <= 20 ? item.completadas : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
