import { createClient }  from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import MembersTable        from '@/components/admin/MembersTable'
import ApprovalsTable      from '@/components/admin/ApprovalsTable'
import TasksBoard          from '@/components/admin/TasksBoard'
import KpiCards            from '@/components/admin/KpiCards'
import PillarChart         from '@/components/admin/PillarChart'
import type { PilarStat, Miembro }  from '@/types'

export const metadata = { title: 'Dashboard – LEAD UPAO Admin' }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const activeTab = searchParams.tab ?? 'dashboard'
  const supabase = await createClient()

  // ── 1. Verificar sesión ──────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Discord OAuth guarda el numeric ID del usuario en provider_id
  const discordId = user.user_metadata?.provider_id ?? ''

  // ── 2. Perfil del usuario logueado en la tabla miembros ──────────────────
  const { data: perfil } = await supabase
    .from('miembros')
    .select('nombre_completo, rol, pilar')
    .eq('discord_id', discordId)
    .maybeSingle()

  // Si no está registrado en la base de datos, mandarlo a onboarding
  if (!perfil) redirect('/onboarding')

  const userRolLead = perfil.rol === 'President' || perfil.rol === 'Vice-President' ? perfil.rol : perfil.pilar
  const userNombre  = perfil.nombre_completo

  // RBAC de Administrador: Solo 'President', 'Vice-President' o 'Innovación Tecnológica'
  const isAuthorizedAdmin = userRolLead === 'President' || userRolLead === 'Vice-President' || userRolLead === 'Innovación Tecnológica'

  // Rol Supervisor: 'President' o 'Vice-President' (permite supervisión global de pilares en Kanban)
  const isSupervisor = userRolLead === 'President' || userRolLead === 'Vice-President'

  // Permisos granulares para el Kanban
  const isLider     = perfil.rol === 'Leader'
  const pilarPropio = perfil.pilar ?? ''

  // Si intenta acceder a pestañas de administrador sin autorización, redirigir al inicio del dashboard
  if ((activeTab === 'miembros' || activeTab === 'solicitudes') && !isAuthorizedAdmin) {
    redirect('/admin?tab=dashboard')
  }

  // ── 3. Consultas condicionales por pestaña ──────────────────────────────
  let totalMiembros = 0
  let verificados = 0
  let tareasActivas = 0
  let pilaresStat: PilarStat[] = []

  if (activeTab === 'dashboard') {
    // Si es administrador, cargamos los totales del equipo
    if (isAuthorizedAdmin) {
      const { data: allMembersRaw } = await supabase
        .from('miembros')
        .select('estado')
      totalMiembros = allMembersRaw?.length ?? 0
      verificados = allMembersRaw?.filter(m => m.estado === 'VERIFICADO').length ?? 0
    }

    // Tareas activas y gráfico de pilares
    const { data: allTareas } = await supabase.from('tareas').select('pilar, estado')
    tareasActivas = (allTareas ?? []).filter(t => t.estado === 'EN_PROGRESO').length

    // Agrupar tareas COMPLETADAS por pilar para el gráfico de barras
    const completadasMap: Record<string, number> = {}
    ;(allTareas ?? [])
      .filter(t => t.estado === 'COMPLETADO')
      .forEach(t => {
        completadasMap[t.pilar] = (completadasMap[t.pilar] ?? 0) + 1
      })
    pilaresStat = Object.entries(completadasMap)
      .map(([pilar, completadas]) => ({ pilar, completadas }))
      .sort((a, b) => b.completadas - a.completadas)
  }

  // Tareas (Tablero)
  let tareas: any[] | null = null
  const userPilar = userRolLead
  const defaultPilar = isSupervisor ? 'Innovación Tecnológica' : userPilar

  if (activeTab === 'tareas') {
    const tareasQuery = supabase.from('tareas').select('*')
    const { data } = isSupervisor
      ? await tareasQuery.order('created_at', { ascending: false })
      : await tareasQuery
          .eq('pilar', userPilar)
          .order('created_at', { ascending: false })
    tareas = data
  }

  // Miembros
  let miembros: Miembro[] | null = null
  if (activeTab === 'miembros' && isAuthorizedAdmin) {
    const { data: allMembers } = await supabase
      .from('miembros')
      .select('*')
      .order('creado_en', { ascending: false })
    miembros = (allMembers ?? []).map(m => ({
      ...m,
      rol_lead: m.rol === 'President' || m.rol === 'Vice-President' ? m.rol : m.pilar
    }))
  }

  // Solicitudes
  let solicitudes: Miembro[] | null = null
  if (activeTab === 'solicitudes' && isAuthorizedAdmin) {
    const { data: pendingRequests } = await supabase
      .from('miembros')
      .select('*')
      .eq('estado', 'PENDIENTE')
      .order('creado_en', { ascending: false })
    solicitudes = (pendingRequests ?? []).map(m => ({
      ...m,
      rol_lead: m.rol === 'President' || m.rol === 'Vice-President' ? m.rol : m.pilar
    }))
  }

  return (
    <div className="space-y-6">
      {/* Encabezado fijo superior */}
      <div className="pb-5 border-b border-gray-200/80">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          Bienvenido, {userNombre} 👋
        </h1>
        <p className="text-gray-500 text-xs mt-1">
          Cargo / Pilar: <span className="font-semibold text-lead-blue">{userRolLead}</span>
          {isAuthorizedAdmin && (
            <span className="ml-2 bg-lead-gold/25 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Administrador
            </span>
          )}
        </p>
      </div>

      {/* Renderizado Condicional de la pestaña activa */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in">
          {/* KPIs */}
          <KpiCards
            totalMiembros={totalMiembros}
            verificados={verificados}
            tareasActivas={tareasActivas}
            isAdmin={isAuthorizedAdmin}
          />

          {/* Gráfico por Pilar */}
          {isAuthorizedAdmin && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-800 mb-4">
                Tareas completadas por pilar
              </h2>
              {pilaresStat.length > 0 ? (
                <PillarChart data={pilaresStat} />
              ) : (
                <p className="text-center text-gray-400 text-sm py-8">
                  Aún no hay tareas completadas registradas.
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {activeTab === 'tareas' && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-800">Tablero de Tareas</h2>
            <p className="text-gray-400 text-[10px]">
              Actualización automática vía Supabase Realtime
            </p>
          </div>
          <TasksBoard
            initialTasks={tareas ?? []}
            userPilar={defaultPilar}
            isDirectiva={isSupervisor}
            isLider={isLider}
            pilarPropio={pilarPropio}
          />
        </section>
      )}

      {activeTab === 'miembros' && isAuthorizedAdmin && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in">
          <h2 className="text-base font-bold text-gray-800 mb-4">Gestión de Miembros</h2>
          <MembersTable initialMembers={miembros ?? []} />
        </section>
      )}

      {activeTab === 'solicitudes' && isAuthorizedAdmin && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in">
          <h2 className="text-base font-bold text-gray-800 mb-4">Solicitudes de Registro Pendientes</h2>
          <ApprovalsTable initialSolicitudes={solicitudes ?? []} adminDiscordId={discordId} />
        </section>
      )}
    </div>
  )
}
