import { createClient }  from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }       from 'next/navigation'
import MembersTable        from '@/components/admin/MembersTable'
import TasksBoard          from '@/components/admin/TasksBoard'
import KpiCards            from '@/components/admin/KpiCards'
import PillarChart         from '@/components/admin/PillarChart'
import AuditLogTable        from '@/components/admin/AuditLogTable'
import ConfiguracionPanel   from '@/components/admin/ConfiguracionPanel'
import { getMiembroPerfil } from '@/lib/miembro'
import { isAdmin as checkIsAdmin, isStaff as checkIsStaff, isFounder as checkIsFounder, getCargoLabel } from '@/lib/auth'
import { obtenerLogsAuditoria } from '@/lib/actions/auditoria'
import { obtenerRoles } from '@/lib/actions/roles'
import { obtenerPilares } from '@/lib/actions/pilares'
import { obtenerRedesSociales } from '@/lib/actions/redesSociales'
import { SIN_AREA } from '@/lib/constants'
import type { PilarStat, Miembro, LogAuditoria, Rol, Pilar, RedSocial }  from '@/types'

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
  const discordId = user.user_metadata?.provider_id ?? null

  // ── 2. Perfil del usuario logueado en la tabla miembros ──────────────────
  const perfil = await getMiembroPerfil(user.id, discordId)

  // El registro de nuevos miembros es solo por administrador
  if (!perfil) redirect('/?error=not_registered')

  const userCargoLabel = getCargoLabel(perfil)
  const userNombre  = perfil.nombre_completo

  // Administrador: gestiona miembros, auditoría y supervisa el Kanban de todos los pilares
  const isAdmin = checkIsAdmin(perfil)

  // Staff: además de admins, cargos de nivel intermedio (ej. Leader) con permisos sobre su propio pilar
  const isStaff = checkIsStaff(perfil)

  // Founder: solo President/Vice-President, gestiona el catálogo de roles y pilares
  const isFounder = checkIsFounder(perfil)

  // Permisos granulares para el Kanban
  const pilarPropio = perfil.pilar ?? ''

  // Si intenta acceder a pestañas restringidas sin autorización, redirigir al inicio del dashboard
  if ((activeTab === 'miembros' || activeTab === 'auditoria') && !isAdmin) {
    redirect('/admin?tab=dashboard')
  }
  if (activeTab === 'configuracion' && !isFounder) {
    redirect('/admin?tab=dashboard')
  }

  // ── 3. Consultas condicionales por pestaña ──────────────────────────────
  let totalMiembros = 0
  let verificados = 0
  let tareasActivas = 0
  let pilaresStat: PilarStat[] = []

  if (activeTab === 'dashboard') {
    // Si es administrador, cargamos los totales del equipo
    if (isAdmin) {
      // `miembros` no concede lectura a la clave pública (ver
      // supabase/hotfix/README.md). El acceso ya está autorizado arriba por
      // isAdmin, así que la consulta va con privilegios de servicio.
      const { data: allMembersRaw } = await createAdminClient()
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
        // `pilar` admite NULL (tareas del foro general). Sin este ?? la
        // gráfica dibujaba una barra rotulada "null".
        const clave = t.pilar ?? SIN_AREA
        completadasMap[clave] = (completadasMap[clave] ?? 0) + 1
      })
    pilaresStat = Object.entries(completadasMap)
      .map(([pilar, completadas]) => ({ pilar, completadas }))
      .sort((a, b) => b.completadas - a.completadas)
  }

  // Catálogos de roles y pilares (selects de Miembros/Tareas/Configuración)
  let roles: Rol[] = []
  let pilares: Pilar[] = []
  if (activeTab === 'miembros' || activeTab === 'tareas' || activeTab === 'configuracion') {
    const [{ data: rolesData }, { data: pilaresData }] = await Promise.all([obtenerRoles(), obtenerPilares()])
    roles = rolesData ?? []
    pilares = pilaresData ?? []
  }

  // Catálogo de redes sociales / enlace de Discord (panel de Configuración)
  let redes: RedSocial[] = []
  if (activeTab === 'configuracion') {
    const { data: redesData } = await obtenerRedesSociales()
    redes = redesData ?? []
  }

  // Tareas (Tablero)
  let tareas: any[] | null = null
  const userPilar = pilarPropio

  if (activeTab === 'tareas') {
    // La Directiva ve todas las áreas. El resto ve la suya Y las tareas
    // generales (`pilar is null`), que viven en el foro general y son de
    // todos: el `.eq('pilar', ...)` anterior las descartaba siempre, así que
    // en la web no existían.
    //
    // Es el mismo criterio que aplica la política RLS de la migración 0010.
    // Se repite aquí a propósito: si la política se cayera, la consulta no
    // debería empezar a devolver de golpe las áreas ajenas.
    const base = supabase.from('tareas').select('*')
    const filtrada = isAdmin
      ? base
      : userPilar
        // Comillas dobles porque los nombres llevan tildes y espacios.
        ? base.or(`pilar.is.null,pilar.eq."${userPilar}"`)
        : base.is('pilar', null)

    const { data } = await filtrada.order('created_at', { ascending: false })
    tareas = data
  }

  // Miembros
  let miembros: Miembro[] | null = null
  if (activeTab === 'miembros' && isAdmin) {
    const { data: allMembers } = await createAdminClient()
      .from('miembros')
      .select('id, discord_id, auth_user_id, nombre_completo, correo_institucional, rol, cargo, pilar, estado, codigo_verificacion, creado_en')
      .order('creado_en', { ascending: false })
    miembros = (allMembers ?? []).map(m => ({
      ...m,
      rol_lead: m.pilar || m.cargo,
    }))
  }

  // Auditoría
  let logsAuditoria: LogAuditoria[] = []
  if (activeTab === 'auditoria' && isAdmin) {
    const { data } = await obtenerLogsAuditoria()
    logsAuditoria = data ?? []
  }

  return (
    <div className="space-y-6">
      {/* Encabezado fijo superior */}
      <div className="pb-5 border-b border-gray-200/80">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          Bienvenido, {userNombre} 👋
        </h1>
        <p className="text-gray-500 text-xs mt-1">
          Cargo / Pilar: <span className="font-semibold text-lead-blue">{userCargoLabel}</span>
          {isAdmin && (
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
            isAdmin={isAdmin}
          />

          {/* Gráfico por Pilar */}
          {isAdmin && (
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
            isDirectiva={isAdmin}
            isStaff={isStaff}
            pilarPropio={pilarPropio}
            pilares={pilares}
            guildId={process.env.DISCORD_GUILD_ID ?? null}
          />
        </section>
      )}

      {activeTab === 'miembros' && isAdmin && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in">
          <h2 className="text-base font-bold text-gray-800 mb-4">Gestión de Miembros</h2>
          <MembersTable initialMembers={miembros ?? []} roles={roles} pilares={pilares} />
        </section>
      )}

      {activeTab === 'auditoria' && isAdmin && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-800">Historial de Auditoría</h2>
            <p className="text-gray-400 text-[10px]">Últimas 200 acciones administrativas registradas</p>
          </div>
          <AuditLogTable logs={logsAuditoria} />
        </section>
      )}

      {activeTab === 'configuracion' && isFounder && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-800">Configuración</h2>
            <p className="text-gray-400 text-[10px]">
              Gestiona los cargos (roles) y pilares oficiales de LEAD UPAO
            </p>
          </div>
          <ConfiguracionPanel roles={roles} pilares={pilares} redes={redes} />
        </section>
      )}
    </div>
  )
}
