import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMiembroPerfil, ErrorDeConfiguracion } from '@/lib/miembro'
import DiscordLoginButton from '@/components/auth/DiscordLoginButton'
import CodeLoginForm from '@/components/auth/CodeLoginForm'

export const metadata = {
  title: 'Iniciar sesión – LEAD UPAO',
  description: 'Panel administrativo de LEAD UPAO.',
}

const ERROR_MESSAGES: Record<string, string> = {
  not_registered:   'Tu cuenta no está registrada como miembro. Contacta a un administrador para que te dé acceso.',
  invalid_code:     'El código de verificación o la contraseña no son correctos.',
  missing_fields:   'Completa tu código de verificación y tu contraseña.',
  pending_approval: 'Tu registro está pendiente de aprobación por un administrador.',
  login_failed:     'No se pudo iniciar sesión. Inténtalo de nuevo o contacta a un administrador.',
  auth_failed:      'No se pudo completar el inicio de sesión con Discord. Inténtalo de nuevo.',
  // Deliberadamente distinto de `not_registered`: aquí el problema es del
  // servidor, y decir "no estás registrado" manda a pedir un acceso que ya se
  // tiene. La causa habitual es una clave de Supabase caducada en el entorno.
  config_error:     'Hay un problema de configuración en el servidor, no con tu cuenta. Avisa al área de TI: el panel no puede consultar la lista de miembros.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const discordId = user.user_metadata?.provider_id ?? null
    try {
      const miembro = await getMiembroPerfil(user.id, discordId)
      if (miembro) redirect('/admin')
    } catch (err) {
      // Esta es la pantalla a la que todo lo demás redirige cuando falla: si
      // ella también revienta, no queda ningún sitio donde leer el motivo.
      if (!(err instanceof ErrorDeConfiguracion)) throw err
      console.error(`[login] ${err.message}`)
    }
  }

  const errorMsg = searchParams.error
    ? (ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.login_failed)
    : null

  const handleSignOut = async () => {
    'use server'
    const sb = await createClient()
    await sb.auth.signOut()
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lead-navy via-lead-blue to-lead-navy flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">LEAD UPAO</h1>
          <p className="text-blue-300 mt-2">Panel Administrativo · Liga Estudiantil de Alto Desarrollo</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 space-y-6 shadow-2xl">
          {errorMsg && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-xl px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}

          {user ? (
            /* Sesión activa pero sin perfil de miembro */
            <div className="text-center space-y-4">
              <p className="text-blue-200 text-sm leading-relaxed">
                Iniciaste sesión, pero tu cuenta no está registrada como miembro de LEAD UPAO.
                Contacta a un administrador para que te dé acceso.
              </p>
              <form action={handleSignOut}>
                <button
                  type="submit"
                  className="w-full border border-white/20 hover:bg-white/5 text-white font-medium py-3 rounded-xl transition text-sm"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <DiscordLoginButton />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-blue-300 text-xs uppercase tracking-widest">o</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <CodeLoginForm />

              <p className="text-center text-blue-300 text-sm">
                ¿Aún no tienes cuenta?{' '}
                <Link href="/registro" className="text-lead-gold hover:underline font-semibold">
                  Regístrate
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
