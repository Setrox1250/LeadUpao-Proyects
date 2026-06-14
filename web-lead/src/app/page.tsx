import { createClient } from '@/lib/supabase/server'
import Hero            from '@/components/landing/Hero'
import NuestroEquipo   from '@/components/landing/NuestroEquipo'
import LogrosProyectos from '@/components/landing/LogrosProyectos'

// Página pública principal — Server Component por defecto (App Router)
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main>
      <Hero user={user} />
      <NuestroEquipo />
      <LogrosProyectos />

      {/* Footer */}
      <footer className="bg-lead-navy py-8 text-center text-blue-300 text-sm">
        <p>© {new Date().getFullYear()} LEAD UPAO · Universidad Privada Antenor Orrego</p>
        <p className="mt-1 text-blue-400/60">Liga Estudiantil de Alto Desarrollo</p>
      </footer>
    </main>
  )
}
