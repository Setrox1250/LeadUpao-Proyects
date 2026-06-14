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
          icon="🎮"
        />
      )}

      {/* KPI 2: Tareas activas */}
      <KpiCard
        label="Tareas En Progreso"
        value={tareasActivas}
        sub="Tareas con estado EN_PROGRESO"
        color="bg-blue-50 border-blue-100"
        iconBg="bg-blue-100"
        icon="⚡"
      />

      {/* KPI 3: Pendientes de verificar */}
      {isAdmin && (
        <KpiCard
          label="Pendientes Discord"
          value={pendientes}
          sub="Miembros sin verificar en Discord"
          color="bg-amber-50 border-amber-100"
          iconBg="bg-amber-100"
          icon="⏳"
        />
      )}
    </div>
  )
}
