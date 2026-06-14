import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RegistroForm from '@/components/registro/RegistroForm'

export const metadata = {
  title: 'Registro – LEAD UPAO',
  description: 'Regístrate como integrante oficial de LEAD UPAO.',
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const discordId = user.user_metadata?.provider_id ?? ''

  // Buscar si ya existe en la base de datos
  const { data: miembroRaw } = await supabase
    .from('miembros')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle()

  const miembro = miembroRaw ? {
    ...miembroRaw,
    rol_lead: miembroRaw.rol === 'President' || miembroRaw.rol === 'Vice-President' ? miembroRaw.rol : miembroRaw.pilar
  } : null

  // Si ya está aprobado o verificado, redirigir al admin
  if (miembro && (miembro.estado === 'APROBADO_ADMIN' || miembro.estado === 'VERIFICADO')) {
    redirect('/admin')
  }

  const handleSignOut = async () => {
    'use server'
    const sb = await createClient()
    await sb.auth.signOut()
    redirect('/')
  }

  const isPending = miembro?.estado === 'PENDIENTE'

  return (
    <div className="min-h-screen bg-gradient-to-br from-lead-navy via-lead-blue to-lead-navy flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block text-lead-gold font-bold text-lg tracking-widest mb-4">
            ← LEAD UPAO
          </a>
          <h1 className="text-3xl font-black text-white tracking-tight">LEAD UPAO</h1>
          <p className="text-blue-300 mt-2">Portal de Onboarding Estudiantil</p>
        </div>

        {isPending ? (
          /* Estado Pendiente: Alerta flotante / Card de Estado */
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Círculo animado pulsante */}
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/30 animate-pulse">
              <span className="text-3xl">⏳</span>
            </div>

            <h2 className="text-2xl font-bold text-white">Solicitud en Evaluación</h2>
            
            <p className="text-blue-200 text-sm leading-relaxed">
              Hola, <strong className="text-white">{miembro.nombre_completo}</strong>. Tu perfil está registrado, pero tu solicitud está siendo evaluada por la directiva o el pilar de <strong className="text-lead-gold">Innovación Tecnológica</strong>.
            </p>
            
            <div className="bg-blue-950/40 border border-blue-900/30 rounded-xl p-4 text-xs text-blue-300">
              Te notificaremos o podrás verificar tu perfil con el bot en Discord una vez que seas admitido.
            </div>

            <form action={handleSignOut} className="pt-2">
              <button
                type="submit"
                className="w-full border border-white/20 hover:bg-white/5 text-white font-medium py-3 rounded-xl transition text-sm"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        ) : (
          /* Formulario de registro */
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">Completa tu Registro</h2>
              <p className="text-blue-200 text-xs mt-1">
                Conectado como: <strong className="text-white">{user.user_metadata?.full_name ?? user.email}</strong>
              </p>
            </div>
            <RegistroForm discordId={discordId} discordName={user.user_metadata?.full_name ?? ''} />
          </div>
        )}
      </div>
    </div>
  )
}
