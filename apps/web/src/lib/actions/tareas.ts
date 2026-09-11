'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin, isStaff } from '@/lib/auth'
import { getMiembroActual } from './shared'
import { registrarAuditoria } from './auditoria'
import { cerrarHiloDeTarea } from './discordSync'
import { esFechaValida } from '@/lib/fechas'
import type { Tarea, EstadoTarea } from '@/types'

// ─── Quién manda sobre una tarea ────────────────────────────────────────
// Una sola definición para las tres acciones, porque tenerla escrita tres
// veces es cómo se desincronizan.
//
// Las tareas sin área (`pilar is null`) viven en el foro general y las ve
// todo el mundo (docs/discord-tareas.md). Antes esto no se decía, y la
// comparación `perfil.pilar === tarea.pilar` acababa concediéndolas justo a
// quien NO tiene área asignada, por pura coincidencia de NULLs.
type Perfil = Awaited<ReturnType<typeof getMiembroActual>>

function puedeEditarTarea(perfil: Perfil, pilarTarea: string | null): boolean {
  if (isAdmin(perfil)) return true
  if (pilarTarea === null) return isStaff(perfil)
  return perfil.pilar === pilarTarea
}

// Borrar es más estricto que mover: Discord no tiene papelera y el hilo queda
// bloqueado y archivado. El backlog general solo lo purga la Directiva.
function puedeEliminarTarea(perfil: Perfil, pilarTarea: string | null): boolean {
  if (isAdmin(perfil)) return true
  return isStaff(perfil) && pilarTarea !== null && perfil.pilar === pilarTarea
}

/** Normaliza y valida una fecha de entrega recibida del cliente. */
function normalizarFecha(valor: string | null | undefined): { fecha: string | null } | { error: string } {
  const fecha = valor?.trim() || null
  if (fecha && !esFechaValida(fecha)) {
    return { error: 'La fecha de entrega no es válida. Formato esperado: AAAA-MM-DD.' }
  }
  return { fecha }
}

// ─── Crear tarea ────────────────────────────────────────────────────────
// Solo administradores (President/Vice-President) o staff (ej. Leaders)
// pueden crear tareas. El staff solo puede crearlas en su propio pilar: el
// pilar recibido del cliente se ignora para ellos y se reemplaza por su
// pilar real, evitando que manipulen el valor enviado al servidor.
export async function crearTarea(input: {
  titulo:             string
  descripcion:        string | null
  // null = tarea general, sin área: va al foro general de Discord.
  pilar:              string | null
  etiquetas:          string[]
  fecha_vencimiento?: string | null
}): Promise<{ data?: Tarea; error?: string }> {
  const perfil = await getMiembroActual()
  const directiva = isAdmin(perfil)
  const staff = isStaff(perfil)

  if (!directiva && !staff) {
    return { error: 'No tienes permisos para crear tareas.' }
  }

  const titulo = input.titulo.trim()
  if (!titulo) {
    return { error: 'El título es obligatorio.' }
  }

  const fechaNormalizada = normalizarFecha(input.fecha_vencimiento)
  if ('error' in fechaNormalizada) return { error: fechaNormalizada.error }

  // El staff no elige área: se le impone la suya. Si no tiene ninguna (Chief
  // of Staff, Tesorería, Marketing), la tarea nace general. Antes se caía de
  // vuelta al `pilar` que enviara el cliente, que es precisamente el valor
  // del que no hay que fiarse.
  const pilar = directiva ? (input.pilar?.trim() || null) : (perfil.pilar ?? null)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tareas')
    .insert({
      titulo,
      descripcion: input.descripcion?.trim() || null,
      pilar,
      etiquetas:   input.etiquetas,
      estado:      'BACKLOG',
      fecha_vencimiento: fechaNormalizada.fecha,
      // Queda null si quien la crea aún no ha vinculado su Discord.
      autor_id:    perfil.discord_id ?? null,
    })
    .select('*')
    .single()

  if (error) return { error: 'No se pudo crear la tarea.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'CREAR_TAREA',
    entidad:     'tarea',
    entidadId:   data.id,
    detalles:    { titulo: data.titulo, pilar: data.pilar, fecha_vencimiento: data.fecha_vencimiento },
  })

  return { data: data as Tarea }
}

// ─── Cambiar estado de una tarea (Kanban) ──────────────────────────────
// Ver `puedeEditarTarea`: Directiva cualquier área, miembros la suya, y las
// tareas generales el staff.
export async function actualizarEstadoTarea(
  taskId: string,
  nuevoEstado: EstadoTarea
): Promise<{ success?: true; error?: string }> {
  const perfil = await getMiembroActual()
  const admin = createAdminClient()

  const { data: tarea } = await admin.from('tareas').select('pilar').eq('id', taskId).maybeSingle()
  if (!tarea) return { error: 'La tarea no existe.' }

  if (!puedeEditarTarea(perfil, tarea.pilar)) {
    return { error: 'No tienes permisos para modificar esta tarea.' }
  }

  const { error } = await admin.from('tareas').update({ estado: nuevoEstado }).eq('id', taskId)
  if (error) return { error: 'No se pudo actualizar la tarea.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ACTUALIZAR_ESTADO_TAREA',
    entidad:     'tarea',
    entidadId:   taskId,
    detalles:    { nuevoEstado },
  })

  return { success: true }
}

// ─── Eliminar tarea ─────────────────────────────────────────────────────
// Ver `puedeEliminarTarea`.
export async function eliminarTarea(
  taskId: string
): Promise<{ success?: true; error?: string; aviso?: string }> {
  const perfil = await getMiembroActual()
  const admin = createAdminClient()

  // Se lee `id_discord_hilo` ANTES de borrar. Es el dato que el bot no puede
  // conseguir por su cuenta: Realtime recorta el registro anterior de los
  // DELETE en tablas con RLS (ver cerrarHiloDeTarea).
  const { data: tarea } = await admin
    .from('tareas')
    .select('pilar, titulo, id_discord_hilo')
    .eq('id', taskId)
    .maybeSingle()
  if (!tarea) return { error: 'La tarea no existe.' }

  if (!puedeEliminarTarea(perfil, tarea.pilar)) {
    return { error: 'No tienes permisos para eliminar esta tarea.' }
  }

  const { error } = await admin.from('tareas').delete().eq('id', taskId)
  if (error) return { error: 'No se pudo eliminar la tarea.' }

  // Después del borrado, no antes: si el borrado fallara, habríamos cerrado el
  // hilo de una tarea que sigue viva. El id ya está en memoria, así que
  // perderlo de la base no importa.
  let aviso: string | undefined
  if (tarea.id_discord_hilo) {
    const cierre = await cerrarHiloDeTarea(tarea.id_discord_hilo)
    if (!cierre.ok) {
      aviso = `Tarea eliminada, pero su hilo de Discord sigue abierto: ${cierre.aviso}`
      console.warn(`[eliminarTarea] ${aviso}`)
    }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ELIMINAR_TAREA',
    entidad:     'tarea',
    entidadId:   taskId,
    detalles:    { titulo: tarea.titulo, pilar: tarea.pilar },
  })

  return { success: true, aviso }
}

// ─── Cambiar la fecha de entrega ────────────────────────────────────────
// Misma regla que mover de columna: quien puede avanzar una tarea puede decir
// para cuándo es. Sin esta acción, `fecha_vencimiento` solo existiría para las
// tareas nuevas: las que ya están en la base nacieron antes de la migración
// 0011 y no habría forma de fecharlas desde el producto.
export async function actualizarFechaTarea(
  taskId: string,
  fecha: string | null
): Promise<{ success?: true; error?: string }> {
  const perfil = await getMiembroActual()
  const admin = createAdminClient()

  const normalizada = normalizarFecha(fecha)
  if ('error' in normalizada) return { error: normalizada.error }

  const { data: tarea } = await admin.from('tareas').select('pilar, titulo').eq('id', taskId).maybeSingle()
  if (!tarea) return { error: 'La tarea no existe.' }

  if (!puedeEditarTarea(perfil, tarea.pilar)) {
    return { error: 'No tienes permisos para modificar esta tarea.' }
  }

  const { error } = await admin
    .from('tareas')
    .update({ fecha_vencimiento: normalizada.fecha })
    .eq('id', taskId)

  if (error) return { error: 'No se pudo actualizar la fecha de entrega.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ACTUALIZAR_FECHA_TAREA',
    entidad:     'tarea',
    entidadId:   taskId,
    detalles:    { titulo: tarea.titulo, fecha_vencimiento: normalizada.fecha },
  })

  return { success: true }
}
