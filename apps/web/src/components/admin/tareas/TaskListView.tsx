'use client'

import { useState } from 'react'
import { TASK_COLUMNS, ETIQUETA_COLORS, type EtiquetaTarea } from '@/lib/constants'
import type { Tarea, EstadoTarea } from '@/types'
import DueDateBadge from './DueDateBadge'
import DiscordThreadLink from './DiscordThreadLink'
import { AreaBadge } from './TaskCard'

type Props = {
  tareas:          Tarea[]
  hoy:             string
  mostrarArea:     boolean
  guildId:         string | null
  puedeEditar:     (t: Tarea) => boolean
  puedeEliminar:   (t: Tarea) => boolean
  onStatusChange:  (id: string, nuevo: EstadoTarea) => Promise<void>
  onFechaChange:   (id: string, fecha: string | null) => Promise<void>
  onDelete:        (id: string) => Promise<void>
}

/**
 * Vista de lista densa: una fila por tarea.
 *
 * El Kanban se lee de un vistazo con veinte tareas y se vuelve inservible con
 * doscientas. Esta vista es la que escala: cabe seis veces más en pantalla,
 * tiene su propio scroll con cabecera fija y no obliga a barrer tres columnas
 * para encontrar algo.
 */
export default function TaskListView({
  tareas, hoy, mostrarArea, guildId,
  puedeEditar, puedeEliminar, onStatusChange, onFechaChange, onDelete,
}: Props) {
  const [confirmando, setConfirmando] = useState<string | null>(null)

  if (tareas.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-12 border border-dashed border-gray-200 rounded-2xl">
        Ninguna tarea coincide con los filtros.
      </p>
    )
  }

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 font-semibold">Tarea</th>
              {mostrarArea && <th className="px-3 py-2 font-semibold w-40">Área</th>}
              <th className="px-3 py-2 font-semibold w-36">Entrega</th>
              <th className="px-3 py-2 font-semibold w-36">Estado</th>
              <th className="px-3 py-2 font-semibold w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tareas.map(t => (
              <tr key={t.id} className="hover:bg-gray-50/70 transition-colors align-top">
                <td className="px-3 py-2">
                  <p className="text-gray-900 leading-snug">{t.titulo}</p>
                  {t.etiquetas?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.etiquetas.map(tag => (
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
                  )}
                </td>

                {mostrarArea && (
                  <td className="px-3 py-2"><AreaBadge pilar={t.pilar} /></td>
                )}

                <td className="px-3 py-2">
                  <DueDateBadge
                    fecha={t.fecha_vencimiento}
                    hoy={hoy}
                    compacto
                    atenuada={t.estado === 'COMPLETADO'}
                    onChange={puedeEditar(t) ? f => onFechaChange(t.id, f) : undefined}
                  />
                </td>

                <td className="px-3 py-2">
                  {puedeEditar(t) ? (
                    <select
                      value={t.estado}
                      onChange={e => onStatusChange(t.id, e.target.value as EstadoTarea)}
                      aria-label={`Estado de ${t.titulo}`}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-lead-blue cursor-pointer"
                    >
                      {TASK_COLUMNS.map(col => (
                        <option key={col.key} value={col.key}>{col.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {TASK_COLUMNS.find(c => c.key === t.estado)?.label ?? t.estado}
                    </span>
                  )}
                </td>

                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <DiscordThreadLink hiloId={t.id_discord_hilo} guildId={guildId} />
                    {puedeEliminar(t) && (
                      confirmando === t.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={async () => { setConfirmando(null); await onDelete(t.id) }}
                            className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-1.5 py-0.5 rounded font-medium"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setConfirmando(null)}
                            className="text-[10px] border border-gray-300 text-gray-600 px-1.5 py-0.5 rounded font-medium"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmando(t.id)}
                          title="Eliminar tarea"
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
