'use client'

import { useState } from 'react'
import { TASK_COLUMNS, ETIQUETA_COLORS, PILAR_COLORS, SIN_AREA, type EtiquetaTarea } from '@/lib/constants'
import type { Tarea, EstadoTarea } from '@/types'
import DueDateBadge from './DueDateBadge'
import DiscordThreadLink from './DiscordThreadLink'

// ─── Botón de papelera con confirmación inline ─────────────────────────────
function DeleteButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1 mt-2">
        <span className="text-[10px] text-red-600 font-medium mr-1">¿Eliminar?</span>
        <button
          onClick={async () => { setDeleting(true); await onConfirm() }}
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
      className="absolute top-3 right-3 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}

// ─── Badge de área ─────────────────────────────────────────────────────────
// Solo aparece cuando la vista mezcla áreas; dentro de una sola sería ruido.
export function AreaBadge({ pilar }: { pilar: string | null }) {
  const nombre = pilar ?? SIN_AREA
  const color  = pilar
    ? (PILAR_COLORS[pilar] ?? 'bg-gray-100 text-gray-600')
    : 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color} truncate max-w-[11rem]`} title={nombre}>
      {nombre}
    </span>
  )
}

type Props = {
  task:            Tarea
  hoy:             string
  mostrarArea:     boolean
  guildId:         string | null
  onStatusChange?: (id: string, nuevo: EstadoTarea) => Promise<void>
  onFechaChange?:  (id: string, fecha: string | null) => Promise<void>
  onDelete?:       () => Promise<void>
}

export default function TaskCard({
  task, hoy, mostrarArea, guildId, onStatusChange, onFechaChange, onDelete,
}: Props) {
  const [updating, setUpdating] = useState(false)

  const cambiarEstado = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!onStatusChange) return
    setUpdating(true)
    await onStatusChange(task.id, e.target.value as EstadoTarea)
    setUpdating(false)
  }

  const columna = TASK_COLUMNS.find(c => c.key === task.estado)

  return (
    <div className="relative group bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">

      {onDelete && <DeleteButton onConfirm={onDelete} />}

      <p className="font-medium text-gray-900 text-sm leading-snug mb-2 pr-6">{task.titulo}</p>

      <div className="flex flex-wrap items-center gap-1 mb-2.5">
        {mostrarArea && <AreaBadge pilar={task.pilar} />}

        <DueDateBadge
          fecha={task.fecha_vencimiento}
          hoy={hoy}
          atenuada={task.estado === 'COMPLETADO'}
          onChange={onFechaChange ? f => onFechaChange(task.id, f) : undefined}
        />

        {task.etiquetas?.map(tag => (
          <span
            key={tag}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
              ETIQUETA_COLORS[tag as EtiquetaTarea] ?? 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {onStatusChange ? (
          <select
            value={task.estado}
            onChange={cambiarEstado}
            disabled={updating}
            aria-label={`Estado de ${task.titulo}`}
            className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lead-blue disabled:opacity-50 cursor-pointer"
          >
            {TASK_COLUMNS.map(col => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
        ) : (
          // Sin permiso sobre esta área: el estado se ve, no se toca.
          <span className="flex-1 min-w-0 text-xs text-gray-500 border border-transparent px-2 py-1.5 truncate">
            {columna?.label ?? task.estado}
          </span>
        )}

        <DiscordThreadLink hiloId={task.id_discord_hilo} guildId={guildId} />
      </div>
    </div>
  )
}
