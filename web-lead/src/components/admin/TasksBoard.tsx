'use client'

import { useEffect, useState } from 'react'
import { createClient }         from '@/lib/supabase/client'
import { PILARES, TASK_COLUMNS, ETIQUETA_COLORS, type EtiquetaTarea } from '@/lib/constants'
import type { Tarea } from '@/types'
import CreateTaskModal from './CreateTaskModal'

type Props = {
  initialTasks:  Tarea[]
  userPilar:     string
  isDirectiva:   boolean
  isLider:       boolean
  pilarPropio:   string
}

// ─── Botón de papelera con confirmación inline ─────────────────────────────
function DeleteButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1 mt-2">
        <span className="text-[10px] text-red-600 font-medium mr-1">¿Eliminar?</span>
        <button
          onClick={async () => {
            setDeleting(true)
            await onConfirm()
          }}
          disabled={deleting}
          className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-md font-medium transition-colors disabled:opacity-60"
        >
          {deleting ? '...' : 'Sí'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-[10px] border border-gray-300 text-gray-600 hover:bg-gray-50 px-2 py-0.5 rounded-md font-medium transition-colors disabled:opacity-60"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title="Eliminar tarea"
      className="absolute top-3 right-3 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}

// ─── Tarjeta de tarea individual ──────────────────────────────────────────
function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task:           Tarea
  onStatusChange: (id: string, newStatus: string) => Promise<void>
  onDelete?:      () => Promise<void>
}) {
  const [updating, setUpdating] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUpdating(true)
    await onStatusChange(task.id, e.target.value)
    setUpdating(false)
  }

  return (
    <div className="relative group bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">

      {onDelete && <DeleteButton onConfirm={onDelete} />}

      <p className="font-medium text-gray-900 text-sm leading-snug mb-2 pr-6">{task.titulo}</p>

      {/* Etiquetas con colores uniformes */}
      {task.etiquetas?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.etiquetas.map(tag => {
            const colorClass = ETIQUETA_COLORS[tag as EtiquetaTarea] ?? 'bg-gray-100 text-gray-500 border-gray-200'
            return (
              <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colorClass}`}>
                {tag}
              </span>
            )
          })}
        </div>
      )}

      {/* Selector de estado */}
      <select
        value={task.estado}
        onChange={handleChange}
        disabled={updating}
        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lead-blue disabled:opacity-50 cursor-pointer"
      >
        {TASK_COLUMNS.map(col => (
          <option key={col.key} value={col.key}>{col.label}</option>
        ))}
      </select>

      {/* Link al hilo de Discord si existe */}
      {task.id_discord_hilo && (
        <p className="text-[10px] text-gray-400 mt-2 font-mono truncate">
          🔗 {task.id_discord_hilo}
        </p>
      )}
    </div>
  )
}

// ─── Tablero Kanban principal ──────────────────────────────────────────────
export default function TasksBoard({
  initialTasks,
  userPilar,
  isDirectiva,
  isLider,
  pilarPropio,
}: Props) {
  const [tasks, setTasks]               = useState<Tarea[]>(initialTasks)
  const [selectedPilar, setSelectedPilar] = useState(userPilar)
  const [realtimeStatus, setStatus]     = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [showCreateModal, setShowCreate] = useState(false)

  const supabase = createClient()

  // Puede eliminar si es directiva (President/VP) o es Leader del pilar de esa tarea
  const canDelete = (task: Tarea) =>
    isDirectiva || (isLider && task.pilar === pilarPropio)

  // ── Suscripción Realtime ───────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('tareas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tareas' },
        payload => {
          if (payload.eventType === 'INSERT') {
            setTasks(prev => [payload.new as Tarea, ...prev])
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
        if (status === 'SUBSCRIBED') setStatus('connected')
        if (status === 'CHANNEL_ERROR') setStatus('error')
      })

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // ── Cambiar estado ─────────────────────────────────────────────────────
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from('tareas')
      .update({ estado: newStatus })
      .eq('id', taskId)

    if (error) console.error('[TasksBoard] Error actualizando estado:', error)
  }

  // ── Eliminar tarea ─────────────────────────────────────────────────────
  const handleDelete = async (taskId: string) => {
    const { error } = await supabase
      .from('tareas')
      .delete()
      .eq('id', taskId)

    if (error) console.error('[TasksBoard] Error eliminando tarea:', error)
    // El DELETE se refleja automáticamente vía Realtime
  }

  const filteredTasks = tasks.filter(t => t.pilar === selectedPilar)

  return (
    <div>
      {/* ── Barra de herramientas ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          {isDirectiva ? (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Ver pilar:</label>
              <select
                value={selectedPilar}
                onChange={e => setSelectedPilar(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lead-blue"
              >
                {PILARES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full font-medium">
                Vista directiva
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Pilar:</span>
              <span className="text-sm font-semibold text-lead-blue bg-lead-light px-3 py-1 rounded-full">
                {selectedPilar}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Indicador Realtime */}
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

          {/* Botón Nueva Tarea — visible para directiva y líderes */}
          {(isDirectiva || isLider) && (
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

      {/* ── Tablero Kanban ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TASK_COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.estado === col.key)
          return (
            <div key={col.key} className={`border-2 rounded-2xl overflow-hidden ${col.bodyColor}`}>
              <div className={`${col.headerColor} px-4 py-3 flex items-center justify-between`}>
                <span className="font-semibold text-sm">{col.label}</span>
                <span className="w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-xs font-bold">
                  {colTasks.length}
                </span>
              </div>
              <div className="p-3 space-y-3 min-h-[120px]">
                {colTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center pt-4">Sin tareas aquí</p>
                ) : (
                  colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onDelete={canDelete(task) ? () => handleDelete(task.id) : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4 text-right">
        {filteredTasks.length} tarea(s) en <strong>{selectedPilar}</strong>
      </p>

      {/* ── Modal de creación ─────────────────────────────────────────── */}
      {showCreateModal && (
        <CreateTaskModal
          defaultPilar={selectedPilar}
          canChangePilar={isDirectiva}
          onClose={() => setShowCreate(false)}
          onSuccess={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
