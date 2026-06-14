// Sección estática de logros y proyectos — Server Component
// Para hacer esta sección dinámica en el futuro, se puede agregar
// una tabla 'proyectos' en Supabase y consultarla aquí.

const LOGROS = [
  {
    icon: '🏆',
    titulo: '1er lugar – Hackathon UPAO 2024',
    descripcion: 'El equipo de Tecnología desarrolló una solución de tutoría académica con IA.',
  },
  {
    icon: '🎤',
    titulo: 'Congreso de Liderazgo Estudiantil',
    descripcion: 'Organizamos el primer congreso interuniversitario con más de 300 asistentes.',
  },
  {
    icon: '📱',
    titulo: 'App de Gestión Estudiantil',
    descripcion: 'Lanzamos una aplicación móvil usada por más de 800 estudiantes de UPAO.',
  },
  {
    icon: '🌱',
    titulo: 'Programa de Mentoría',
    descripcion: 'Conectamos a 50 estudiantes de primer año con mentores de las mejores empresas de Trujillo.',
  },
]

const PROYECTOS = [
  {
    pilar: 'Tecnología',
    nombre: 'Portal de Recursos Académicos',
    estado: 'En desarrollo',
    estadoColor: 'bg-blue-100 text-blue-700',
  },
  {
    pilar: 'Marketing',
    nombre: 'Campaña de Visibilidad 2025',
    estado: 'Activo',
    estadoColor: 'bg-green-100 text-green-700',
  },
  {
    pilar: 'Investigación',
    nombre: 'Estudio de Empleabilidad UPAO',
    estado: 'Completado',
    estadoColor: 'bg-gray-100 text-gray-700',
  },
  {
    pilar: 'Eventos',
    nombre: 'LEAD Summit 2025',
    estado: 'Próximamente',
    estadoColor: 'bg-amber-100 text-amber-700',
  },
]

export default function LogrosProyectos() {
  return (
    <>
      {/* ── Logros ────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-lead-gold font-semibold text-sm uppercase tracking-widest">
              Lo que hemos construido
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2">Nuestros Logros</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {LOGROS.map(logro => (
              <div
                key={logro.titulo}
                className="bg-lead-light rounded-2xl p-6 border border-blue-100 hover:border-lead-blue/30 transition-colors"
              >
                <div className="text-4xl mb-4">{logro.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2 leading-snug">{logro.titulo}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{logro.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proyectos ─────────────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-lead-gold font-semibold text-sm uppercase tracking-widest">
              Iniciativas en marcha
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2">Proyectos Destacados</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PROYECTOS.map(proyecto => (
              <div
                key={proyecto.nombre}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {proyecto.pilar}
                </p>
                <h3 className="font-bold text-gray-900 mb-4 leading-snug">{proyecto.nombre}</h3>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${proyecto.estadoColor}`}>
                  {proyecto.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
