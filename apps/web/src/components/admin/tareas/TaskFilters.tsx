'use client'

import {
  TASK_COLUMNS, ETIQUETAS_TAREA, ORDENES, FILTROS_VENCIMIENTO,
  AREA_TODAS, AREA_GENERAL, SIN_AREA,
  type OrdenTareas, type FiltroVencimiento,
} from '@/lib/constants'
import type { EstadoTarea } from '@/types'

export type Filtros = {
  area:        string
  estado:      EstadoTarea | 'TODOS'
  etiqueta:    string
  vencimiento: FiltroVencimiento
  busqueda:    string
  orden:       OrdenTareas
}

export const FILTROS_INICIALES: Filtros = {
  area:        AREA_TODAS,
  estado:      'TODOS',
  etiqueta:    'TODAS',
  vencimiento: 'TODAS',
  busqueda:    '',
  orden:       'vencimiento',
}

const SELECT = 'text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lead-blue'

type Props = {
  filtros:    Filtros
  onChange:   (f: Filtros) => void
  /** Nombres de pilar que este usuario puede llegar a ver. */
  areas:      string[]
  /** Cuántas tareas hay por área tras aplicar el resto de filtros. */
  conteos:    Record<string, number>
  totalVisible: number
  totalCargado: number
}

export default function TaskFilters({ filtros, onChange, areas, conteos, totalVisible, totalCargado }: Props) {
  const set = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) =>
    onChange({ ...filtros, [campo]: valor })

  const hayFiltros =
    filtros.area !== AREA_TODAS || filtros.estado !== 'TODOS' ||
    filtros.etiqueta !== 'TODAS' || filtros.vencimiento !== 'TODAS' ||
    filtros.busqueda.trim() !== ''

  // Una sola área visible y sin tareas generales: las pastillas no deciden
  // nada, así que estorban.
  const mostrarPastillas = areas.length > 1 || (conteos[AREA_GENERAL] ?? 0) > 0

  const Pastilla = ({ valor, etiqueta }: { valor: string; etiqueta: string }) => {
    const activa = filtros.area === valor
    const n = valor === AREA_TODAS ? totalVisible : (conteos[valor] ?? 0)
    return (
      <button
        type="button"
        onClick={() => set('area', valor)}
        aria-pressed={activa}
        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
          activa
            ? 'bg-lead-navy text-white border-lead-navy'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
        }`}
      >
        <span className="truncate">{etiqueta}</span>
        <span className={`ml-1.5 ${activa ? 'text-white/70' : 'text-gray-400'}`}>{n}</span>
      </button>
    )
  }

  return (
    <div className="space-y-3 mb-5">
      {mostrarPastillas && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Pastilla valor={AREA_TODAS} etiqueta="Todas las áreas" />
          {areas.map(a => <Pastilla key={a} valor={a} etiqueta={a} />)}
          <Pastilla valor={AREA_GENERAL} etiqueta={SIN_AREA} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <input
            type="search"
            value={filtros.busqueda}
            onChange={e => set('busqueda', e.target.value)}
            placeholder="Buscar por título o descripción..."
            aria-label="Buscar tareas"
            className="w-full text-xs border border-gray-300 rounded-lg pl-7 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lead-blue"
          />
          <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </div>

        <select value={filtros.estado} onChange={e => set('estado', e.target.value as Filtros['estado'])} aria-label="Filtrar por estado" className={SELECT}>
          <option value="TODOS">Todos los estados</option>
          {TASK_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        <select value={filtros.etiqueta} onChange={e => set('etiqueta', e.target.value)} aria-label="Filtrar por etiqueta" className={SELECT}>
          <option value="TODAS">Todas las etiquetas</option>
          {ETIQUETAS_TAREA.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filtros.vencimiento} onChange={e => set('vencimiento', e.target.value as FiltroVencimiento)} aria-label="Filtrar por vencimiento" className={SELECT}>
          {FILTROS_VENCIMIENTO.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>

        <select value={filtros.orden} onChange={e => set('orden', e.target.value as OrdenTareas)} aria-label="Ordenar por" className={SELECT}>
          {ORDENES.map(o => <option key={o.key} value={o.key}>Ordenar: {o.label}</option>)}
        </select>

        {hayFiltros && (
          <button
            type="button"
            onClick={() => onChange(FILTROS_INICIALES)}
            className="text-xs text-gray-500 hover:text-lead-blue underline underline-offset-2"
          >
            Limpiar
          </button>
        )}
      </div>

      {hayFiltros && (
        <p className="text-[11px] text-gray-400">
          Mostrando {totalVisible} de {totalCargado} tarea(s).
        </p>
      )}
    </div>
  )
}
