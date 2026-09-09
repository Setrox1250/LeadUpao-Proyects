import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Sidebar          from '@/components/admin/Sidebar'
import ToastProvider    from '@/components/ui/Toast'
import { getMiembroPerfil } from '@/lib/miembro'
import { isAdmin as checkIsAdmin, isFounder as checkIsFounder, getCargoLabel } from '@/lib/auth'

// El middleware ya bloquea el acceso no autenticado,
// pero este layout hace una segunda verificación server-side
// y proporciona la barra de navegación del panel admin.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const discordId = user.user_metadata?.provider_id ?? null

  // Obtener perfil para la barra lateral y validación de roles
  const perfil = await getMiembroPerfil(user.id, discordId)

  // El registro de nuevos miembros es solo por administrador
  if (!perfil) redirect('/?error=not_registered')

  const userNombre  = perfil.nombre_completo ?? user.user_metadata?.full_name ?? user.email ?? 'Miembro'
  const userCargoLabel = getCargoLabel(perfil)
  const isAdmin   = checkIsAdmin(perfil)
  const isFounder = checkIsFounder(perfil)

  const handleSignOut = async () => {
    'use server'
    const sb = await createClient()
    await sb.auth.signOut()
    redirect('/')
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
        {/* Barra lateral / Sidebar responsiva */}
        <Sidebar
          userName={userNombre}
          userRole={userCargoLabel}
          isAdmin={isAdmin}
          isFounder={isFounder}
          signOutAction={handleSignOut}
        />

        {/* Contenido principal scrollable */}
        <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto">
          <main className="p-6 md:p-8 max-w-6xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
