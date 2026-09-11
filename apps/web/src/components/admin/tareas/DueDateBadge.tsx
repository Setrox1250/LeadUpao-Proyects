'use client'

import { useState } from 'react'
import { VENCIMIENTO_COLORS } from '@/lib/constants'
import { esFechaValida, formatearFecha, textoVencimiento, urgenciaDe } from '@/lib/fechas'

type Props = {
  fecha:     string | null
  hoy:       string
  /** Sin esto el badge es de solo lectura (el usuario no manda en esa tarea). */
  onChange?: (fecha: string | null) => Promise<void>
  compacto?: boolean
  /**
   * Una tarea completada ya no vence: se entregó. Sin esto el tablero
   * gritaba «⚠️ Venció hace 3 días» en la columna Completado, que es
   * exactamente el aviso que no hay que dar.
   */
  atenuada?: boolean
}

/**
 * Muestra `fecha_vencimiento` y, si se puede editar, la cambia en el sitio.
 *
 * La edición existe porque sin ella la fecha solo sirve para las tareas
 * nuevas: las que ya están en la base nacieron antes de la migración 0011 y
 * no habría forma de ponerles una desde el producto.
 */
export default function DueDateBadge({ fecha, hoy, onChange, compacto = false, atenuada = false }: Props) {
  const [editando, setEditando]   = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrador, setBorrador]   = useState('')

  // Se confirma al salir del campo, NO en cada `change`.
  //
  // Un <input type="date"> emite un evento por cada segmento que se teclea,
  // así que guardar ahí manda a la base años a medio escribir: tecleando
  // "25/09/2026" llega a disparar un guardado con el año 0002. Se vio
  // pasando en el navegador, no razonándolo.
  const confirmar = async () => {
    setEditando(false)
    if (!onChange) return

    const valor = borrador || null
    if (valor === (fecha ?? null)) return          // no cambió nada
    if (valor && !esFechaValida(valor)) return     // a medio escribir: se ignora

    setGuardando(true)
    await onChange(valor)
    setGuardando(false)
  }

  if (editando && onChange) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="date"
          value={borrador}
          autoFocus
          disabled={guardando}
          onChange={e => setBorrador(e.target.value)}
          onBlur={confirmar}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); e.currentTarget.blur() }
            if (e.key === 'Escape') { setBorrador(fecha ?? ''); setEditando(false) }
          }}
          className="text-[11px] border border-gray-300 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-lead-blue disabled:opacity-60"
        />
        {fecha && (
          <button
            type="button"
            title="Quitar fecha de entrega"
            disabled={guardando}
            // onMouseDown: el onBlur del input se dispara antes que el click y
            // desmontaría este botón sin llegar a ejecutarlo.
            onMouseDown={e => { e.preventDefault(); setBorrador(''); setEditando(false); onChange(null) }}
            className="text-[11px] text-gray-400 hover:text-red-500 px-1"
          >
            ✕
          </button>
        )}
      </span>
    )
  }

  const abrirEditor = () => { setBorrador(fecha ?? ''); setEditando(true) }

  const clase = 'text-[10px] font-medium px-1.5 py-0.5 rounded border inline-flex items-center gap-1'
  const editable = onChange
    ? 'cursor-pointer hover:ring-1 hover:ring-lead-blue/40'
    : ''

  if (!fecha) {
    if (!onChange) return null
    return (
      <button
        type="button"
        onClick={abrirEditor}
        title="Asignar fecha de entrega"
        className={`${clase} bg-white text-gray-400 border-dashed border-gray-300 hover:text-lead-blue hover:border-lead-blue`}
      >
        📅 {compacto ? 'Fecha' : 'Sin fecha'}
      </button>
    )
  }

  const urgencia = atenuada ? 'futura' : urgenciaDe(fecha, hoy)

  return (
    <button
      type="button"
      onClick={() => onChange && abrirEditor()}
      disabled={!onChange}
      title={onChange ? `Entrega: ${fecha} (clic para cambiar)` : `Entrega: ${fecha}`}
      className={`${clase} ${VENCIMIENTO_COLORS[urgencia]} ${editable} disabled:cursor-default`}
    >
      {urgencia === 'vencida' ? '⚠️' : '📅'} {atenuada ? formatearFecha(fecha, hoy) : textoVencimiento(fecha, hoy)}
    </button>
  )
}
