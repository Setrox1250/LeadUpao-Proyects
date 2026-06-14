import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Sidebar          from '@/components/admin/Sidebar'

// El middleware ya bloquea el acceso no autenticado,
// pero este layout hace una segunda verificación server-side
// y proporciona la barra de navegación del panel admin.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const discordId = user.user_metadata?.provider_id ?? ''

  // Obtener perfil para la barra lateral y validación de roles
  const { data: perfil } = await supabase
    .from('miembros')
    .select('nombre_completo, rol, pilar')
    .eq('discord_id', discordId)
    .maybeSingle()

  const userNombre  = perfil?.nombre_completo ?? user.user_metadata?.full_name ?? user.email ?? 'Miembro'
  const userRolLead = perfil ? (perfil.rol === 'President' || perfil.rol === 'Vice-President' ? perfil.rol : perfil.pilar) : 'Miembro'
  const isAuthorizedAdmin = userRolLead === 'President' || userRolLead === 'Vice-President' || userRolLead === 'Innovación Tecnológica'

  const handleSignOut = async () => {
    'use server'
    const sb = await createClient()
    await sb.auth.signOut()
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Barra lateral / Sidebar responsiva */}
      <Sidebar
        userName={userNombre}
        userRole={userRolLead}
        isAdmin={isAuthorizedAdmin}
        signOutAction={handleSignOut}
      />

      {/* Contenido principal scrollable */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto">
        <main className="p-6 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
