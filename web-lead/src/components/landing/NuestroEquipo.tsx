import { createClient } from '@/lib/supabase/server'
import type { Miembro }  from '@/types'

// Colores por pilar para los badges de cada tarjeta
const PILAR_COLORS: Record<string, string> = {
  'Innovación Tecnológica': 'bg-blue-100 text-blue-700',
  'Desarrollo del Capítulo': 'bg-indigo-100 text-indigo-700',
  'Excelencia Académica': 'bg-purple-100 text-purple-700',
  'Liderazgo': 'bg-orange-100 text-orange-700',
  'Desarrollo Profesional': 'bg-green-100 text-green-700',
  'Impacto Comunitario': 'bg-pink-100 text-pink-700',
  'Excelencia Femenina': 'bg-rose-100 text-rose-700',
  'LEAD Academia': 'bg-cyan-100 text-cyan-700',
}

function MemberCard({ miembro }: { miembro: Pick<Miembro, 'id' | 'nombre_completo' | 'rol_lead'> }) {
  const initials = miembro.nombre_completo
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  const badgeClass = PILAR_COLORS[miembro.rol_lead] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 text-center">
      {/* Avatar con iniciales */}
      <div className="w-16 h-16 rounded-full bg-lead-gradient flex items-center justify-center mx-auto mb-3">
        <span className="text-white font-bold text-lg">{initials}</span>
      </div>
      <p className="font-semibold text-gray-900 leading-tight">{miembro.nombre_completo}</p>
      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-2 ${badgeClass}`}>
        {miembro.rol_lead}
      </span>
    </div>
  )
}

// Server Component: consulta directamente a Supabase sin exponer credenciales al cliente
export default async function NuestroEquipo() {
  const supabase = await createClient()

  const { data: miembrosRaw, error } = await supabase
    .from('miembros')
    .select('id, nombre_completo, rol, pilar')
    .eq('estado', 'VERIFICADO')
    .order('nombre_completo')

  if (error) console.error('[NuestroEquipo] Error al cargar miembros:', error.message)

  const miembros = miembrosRaw?.map(m => ({
    id: m.id,
    nombre_completo: m.nombre_completo,
    rol_lead: m.rol === 'President' || m.rol === 'Vice-President' ? m.rol : m.pilar
  }))

  return (
    <section id="equipo" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Encabezado de sección */}
        <div className="text-center mb-14">
          <span className="text-lead-gold font-semibold text-sm uppercase tracking-widest">
            El equipo detrás de LEAD
          </span>
          <h2 className="text-4xl font-bold text-gray-900 mt-2">Nuestros Integrantes</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            Personas comprometidas con el liderazgo estudiantil, organizadas en pilares de
            trabajo para maximizar el impacto en nuestra comunidad.
          </p>
        </div>

        {/* Grid de miembros */}
        {miembros && miembros.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {miembros.map(m => (
              <MemberCard key={m.id} miembro={m} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400">
            Aún no hay miembros verificados. ¡Sé el primero en{' '}
            <a href="/onboarding" className="text-lead-blue underline">unirte</a>!
          </p>
        )}

        {/* CTA para unirse */}
        <div className="text-center mt-12">
          <a
            href="/onboarding"
            className="inline-flex items-center gap-2 bg-lead-navy hover:bg-lead-blue text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-200"
          >
            Quiero unirme →
          </a>
        </div>
      </div>
    </section>
  )
}
