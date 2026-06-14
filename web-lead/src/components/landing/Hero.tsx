import DiscordLoginButton from '@/components/auth/DiscordLoginButton'

// Server Component — no necesita 'use client'
export default function Hero({ user }: { user: any }) {
  return (
    <section className="relative min-h-screen bg-lead-gradient flex items-center overflow-hidden">
      {/* Círculos decorativos de fondo */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-lead-gold/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lead-blue/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 text-center w-full">
        {/* Badge superior */}
        <div className="inline-flex items-center gap-2 bg-lead-gold/20 border border-lead-gold/30 rounded-full px-5 py-2 text-lead-gold text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-lead-gold rounded-full animate-pulse" />
          Liga Estudiantil de Alto Desarrollo · UPAO
        </div>

        {/* Titular principal */}
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight">
          Liderando el<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-lead-red via-lead-crimson to-lead-magenta">
            Futuro Universitario
          </span>
        </h1>

        {/* Descripción */}
        <p className="text-xl text-blue-200 max-w-2xl mx-auto mb-10 leading-relaxed">
          LEAD UPAO es la organización estudiantil que impulsa el liderazgo, la innovación y
          el desarrollo profesional dentro de la Universidad Privada Antenor Orrego.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {user ? (
            <a
              href="/admin"
              className="inline-flex items-center justify-center gap-2 bg-lead-gold hover:bg-lead-crimson text-white font-bold py-3.5 px-8 rounded-xl transition-colors duration-200 text-lg shadow-lg"
            >
              Ir al Dashboard →
            </a>
          ) : (
            <DiscordLoginButton />
          )}
          <a
            href="#equipo"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold py-3.5 px-8 rounded-xl transition-colors duration-200 text-lg backdrop-blur-sm"
          >
            Conoce al equipo
          </a>
        </div>

        {/* Estadísticas rápidas (decorativas) */}
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto border-t border-white/10 pt-10">
          {[
            { label: 'Miembros activos', value: '30+' },
            { label: 'Pilares de trabajo', value: '7'   },
            { label: 'Proyectos lanzados', value: '12+' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-black text-lead-gold">{stat.value}</div>
              <div className="text-blue-300 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Flecha de scroll */}
      <a
        href="#equipo"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/80 transition-colors animate-bounce"
        aria-label="Desplazarse hacia abajo"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </a>
    </section>
  )
}
