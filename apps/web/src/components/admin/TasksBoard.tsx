'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { actualizarEstadoTarea, actualizarFechaTarea, eliminarTarea } from '@/lib/actions/tareas'
import {
  TASK_COLUMNS, AREA_TODAS, AREA_GENERAL, SIN_AREA,
} from '@/lib/constants'
import { hoyEnLima, diasEntre } from '@/lib/fechas'
import { useToast } from '@/components/ui/Toast'
import type { Tarea, EstadoTarea, Pilar } from '@/types'
import CreateTaskModal from './CreateTaskModal'
import TaskCard from './tareas/TaskCard'
import TaskListView from './tareas/TaskListView'
import TaskFilters, { FILTROS_INICIALES, type Filtros } from './tareas/TaskFilters'

type Props = {
  initialTasks: Tarea[]
  isDirectiva:  boolean
  isStaff:      boolean
  pilarPropio:  string
  pilares:      Pilar[]
  /** Id del servidor de Discord, para enlazar los hilos. Null si no se configuró. */
  guildId:      string | null
}

type Vista = 'tablero' | 'lista'

export default function TasksBoard({
  initialTasks, isDirectiva, isStaff, pilarPropio, pilares, guildId,
}: Props) {
  const { showToast } = useToast()
  const [tasks, setTasks]     = useState<Tarea[]>(initialTasks)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [vista, setVista]     = useState<Vista>('tablero')
  const [realtimeStatus, setStatus]      = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [showCreateModal, setShowCreate] = useState(false)

  const supabase = createClient()

  // Se calcula una vez por render y se pasa hacia abajo: si cada tarjeta
  // llamara a hoyEnLima() por su cuenta, un tablero grande haría cientos de
  // Intl.DateTimeFormat para obtener siempre el mismo valor.
  const hoy = hoyEnLima()

  // ── Permisos ───────────────────────────────────────────────────────────
  // Espejo de lo que comprueban las Server Actions. Aquí solo decide qué se
  // muestra; la autorización real está en el servidor.
  //
  // Las tareas sin área (foro general) las ve todo el mundo, así que hay que
  // decir explícitamente quién puede moverlas: staff y Directiva. Sin este
  // caso, la comparación `perfil.pilar === tarea.pilar` dejaba moverlas justo
  // a quien NO tiene área, que es lo contrario de lo que se quiere.
  const puedeEditar = (t: Tarea) =>
    isDirectiva || (t.pilar === null ? isStaff : t.pilar === pilarPropio)

  const puedeEliminar = (t: Tarea) =>
    isDirectiva || (isStaff && t.pilar !== null && t.pilar === pilarPropio)

  // ── Suscripción Realtime ───────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('tareas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tareas' },
        payload => {
          if (payload.eventType === 'INSERT') {
            const nueva = payload.new as Tarea
            // Una reconexión puede reenviar el mismo INSERT; sin esta guarda
            // la tarea aparecería dos veces y React avisaría de claves
            // duplicadas.
            setTasks(prev => prev.some(t => t.id === nueva.id) ? prev : [nueva, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev =>
              prev.map(t => t.id === (payload.new as Tarea).id ? payload.new as Tarea : t)
            )
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED')    setStatus('connected')
        if (status === 'CHANNEL_ERROR') setStatus('error')
      })

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // ── Acciones ───────────────────────────────────────────────────────────
  const handleStatusChange = async (taskId: string, nuevo: EstadoTarea) => {
    const { error } = await actualizarEstadoTarea(taskId, nuevo)
    if (error) showToast('error', error)
  }

  const handleFechaChange = async (taskId: string, fecha: string | null) => {
    const { error } = await actualizarFechaTarea(taskId, fecha)
    if (error) showToast('error', error)
    else showToast('success', fecha ? 'Fecha de entrega actualizada.' : 'Fecha de entrega quitada.')
  }

  const handleDelete = async (taskId: string) => {
    const { error } = await eliminarTarea(taskId)
    if (error) showToast('error', error)
    // El DELETE se refleja automáticamente vía Realtime
  }

  // ── Áreas que este usuario puede llegar a ver ──────────────────────────
  // La Directiva, todas; el resto, la suya. Las tareas generales tienen su
  // propia pastilla y no dependen de esto.
  const areasVisibles = useMemo(
    () => isDirectiva ? pilares.map(p => p.nombre) : (pilarPropio ? [pilarPropio] : []),
    [isDirectiva, pilares, pilarPropio],
  )

  // ── Filtrado ───────────────────────────────────────────────────────────
  // Todo menos el área: así los contadores de cada pastilla reflejan el
  // resto de filtros, que es lo que se espera al ver "Académica (3)".
  const sinFiltroDeArea = useMemo(() => {
    const busqueda = filtros.busqueda.trim().toLowerCase()

    return tasks.filter(t => {
      if (filtros.estado !== 'TODOS' && t.estado !== filtros.estado) return false
      if (filtros.etiqueta !== 'TODAS' && !t.etiquetas?.includes(filtros.etiqueta)) return false

      if (filtros.vencimiento !== 'TODAS') {
        const f = t.fecha_vencimiento
        if (filtros.vencimiento === 'SIN_FECHA' && f) return false
        // Una tarea completada no está vencida, está entregada. Excluirla
        // aquí es lo que hace que el filtro y el contador «N vencida(s)»
        // digan el mismo número.
        if (filtros.vencimiento === 'VENCIDAS' &&
            (!f || diasEntre(hoy, f) >= 0 || t.estado === 'COMPLETADO')) return false
        if (filtros.vencimiento === 'SEMANA') {
          if (!f) return false
          const dias = diasEntre(hoy, f)
          if (dias < 0 || dias > 7) return false
        }
      }

      if (busqueda) {
        const heno = `${t.titulo} ${t.descripcion ?? ''}`.toLowerCase()
        if (!heno.includes(busqueda)) return false
      }

      return true
    })
  }, [tasks, filtros, hoy])

  const conteos = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const t of sinFiltroDeArea) {
      const clave = t.pilar ?? AREA_GENERAL
      acc[clave] = (acc[clave] ?? 0) + 1
    }
    return acc
  }, [sinFiltroDeArea])

  const visibles = useMemo(() => {
    const porArea = filtros.area === AREA_TODAS
      ? sinFiltroDeArea
      : sinFiltroDeArea.filter(t =>
          filtros.area === AREA_GENERAL ? t.pilar === null : t.pilar === filtros.area)

    // Copia antes de ordenar: sort() muta, y el array viene de un useMemo.
    return [...porArea].sort((a, b) => {
      if (filtros.orden === 'titulo')    return a.titulo.localeCompare(b.titulo, 'es')
      if (filtros.orden === 'recientes') return (b.created_at ?? '').localeCompare(a.created_at ?? '')

      // Por vencimiento: lo que vence antes arriba, lo que no tiene fecha al
      // final. Las cadenas 'YYYY-MM-DD' se ordenan bien como texto.
      const fa = a.fecha_vencimiento
      const fb = b.fecha_vencimiento
      if (fa && fb && fa !== fb) return fa < fb ? -1 : 1
      if (fa && !fb) return -1
      if (!fa && fb) return 1
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
  }, [sinFiltroDeArea, filtros.area, filtros.orden])

  // El badge de área solo aporta cuando la vista mezcla áreas.
  const mostrarArea = filtros.area === AREA_TODAS

  // Área por defecto del formulario: nunca un centinela del filtro.
  const pilarParaCrear =
    filtros.area !== AREA_TODAS && filtros.area !== AREA_GENERAL ? filtros.area
    : filtros.area === AREA_GENERAL ? ''
    : (pilarPropio || areasVisibles[0] || '')

  const vencidas = visibles.filter(
    t => t.fecha_vencimiento && diasEntre(hoy, t.fecha_vencimiento) < 0 && t.estado !== 'COMPLETADO'
  ).length

  return (
    <div>
      {/* ── Barra superior ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
            {(['tablero', 'lista'] as const).map(v => (
              <button
                key={v}
                onClick={() => setVista(v)}
                aria-pressed={vista === v}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  vista === v ? 'bg-white text-lead-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'tablero' ? 'Tablero' : 'Lista'}
              </button>
            ))}
          </div>

          {isDirectiva && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full font-medium">
              Vista directiva
            </span>
          )}

          {vencidas > 0 && (
            <button
              type="button"
              onClick={() => setFiltros({ ...filtros, vencimiento: 'VENCIDAS', estado: 'TODOS' })}
              className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-full font-medium hover:bg-red-100 transition-colors"
            >
              ⚠️ {vencidas} vencida(s)
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              realtimeStatus === 'connected' ? 'bg-green-400 animate-pulse' :
              realtimeStatus === 'error'     ? 'bg-red-400' : 'bg-gray-400'
            }`} />
            <span className="text-gray-400">
              {realtimeStatus === 'connected' ? 'En vivo' :
               realtimeStatus === 'error'     ? 'Sin conexión en vivo' : 'Conectando...'}
            </span>
          </div>

          {(isDirectiva || isStaff) && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-lead-navy hover:bg-lead-blue text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Tarea
            </button>
          )}
        </div>
      </div>

      <TaskFilters
        filtros={filtros}
        onChange={setFiltros}
        areas={areasVisibles}
        conteos={conteos}
        totalVisible={visibles.length}
        totalCargado={tasks.length}
      />

      {/* ── Vista ───────────────────────────────────────────────────────── */}
      {vista === 'lista' ? (
        <TaskListView
          tareas={visibles}
          hoy={hoy}
          mostrarArea={mostrarArea}
          guildId={guildId}
          puedeEditar={puedeEditar}
          puedeEliminar={puedeEliminar}
          onStatusChange={handleStatusChange}
          onFechaChange={handleFechaChange}
          onDelete={handleDelete}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TASK_COLUMNS.map(col => {
            const colTasks = visibles.filter(t => t.estado === col.key)
            return (
              <div key={col.key} className={`border-2 rounded-2xl overflow-hidden flex flex-col ${col.bodyColor}`}>
                <div className={`${col.headerColor} px-4 py-3 flex items-center justify-between shrink-0`}>
                  <span className="font-semibold text-sm">{col.label}</span>
                  <span className="min-w-6 h-6 px-1.5 rounded-full bg-white/60 flex items-center justify-center text-xs font-bold">
                    {colTasks.length}
                  </span>
                </div>
                {/* Scroll propio: con treinta tareas en Backlog, sin esto la
                    página entera se vuelve un pergamino. */}
                <div className="p-3 space-y-3 min-h-[120px] max-h-[62vh] overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center pt-4">Sin tareas aquí</p>
                  ) : (
                    colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        hoy={hoy}
                        mostrarArea={mostrarArea}
                        guildId={guildId}
                        onStatusChange={puedeEditar(task) ? handleStatusChange : undefined}
                        onFechaChange={puedeEditar(task) ? handleFechaChange : undefined}
                        onDelete={puedeEliminar(task) ? () => handleDelete(task.id) : undefined}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 text-right">
        {visibles.length} tarea(s) en{' '}
        <strong>
          {filtros.area === AREA_TODAS ? 'todas las áreas'
            : filtros.area === AREA_GENERAL ? SIN_AREA
            : filtros.area}
        </strong>
      </p>

      {showCreateModal && (
        <CreateTaskModal
          defaultPilar={pilarParaCrear}
          canChangePilar={isDirectiva}
          pilares={pilares}
          onClose={() => setShowCreate(false)}
          onSuccess={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
