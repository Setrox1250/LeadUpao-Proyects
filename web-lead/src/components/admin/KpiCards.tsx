// Server Component — solo recibe props calculados desde el Server Page
type Props = {
  totalMiembros: number
  verificados:   number
  tareasActivas: number
  isAdmin?:      boolean
}

type CardProps = {
  label:       string
  value:       string | number
  sub?:        string
  color:       string
  iconBg:      string
  icon:        React.ReactNode
}

function KpiCard({ label, value, sub, color, iconBg, icon }: CardProps) {
  return (
    <div className={`rounded-2xl p-6 border ${color} flex items-start gap-4`}>
      <div className={`${iconBg} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-3xl font-black text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function KpiCards({ totalMiembros, verificados, tareasActivas, isAdmin = true }: Props) {
  const adopcion    = totalMiembros > 0 ? Math.round((verificados / totalMiembros) * 100) : 0
  const pendientes  = totalMiembros - verificados

  return (
    <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-3' : ''} gap-5`}>
      {/* KPI 1: Adopción de Discord */}
      {isAdmin && (
        <KpiCard
          label="Adopción Discord"
          value={`${adopcion}%`}
          sub={`${verificados} de ${totalMiembros} miembros verificados`}
          color="bg-purple-50 border-purple-100"
          iconBg="bg-purple-100"
          icon={
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-3.13a4 4 0 10-8 0 4 4 0 008 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
      )}

      {/* KPI 2: Tareas activas */}
      <KpiCard
        label="Tareas En Progreso"
        value={tareasActivas}
        sub="Tareas con estado EN_PROGRESO"
        color="bg-blue-50 border-blue-100"
        iconBg="bg-blue-100"
        icon={
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />

      {/* KPI 3: Pendientes de verificar */}
      {isAdmin && (
        <KpiCard
          label="Pendientes Discord"
          value={pendientes}
          sub="Miembros sin verificar en Discord"
          color="bg-amber-50 border-amber-100"
          iconBg="bg-amber-100"
          icon={
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      )}
    </div>
  )
}
