'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { hashPassword, verifyPassword, validarContrasena } from '@/lib/password'
import { isAdmin } from '@/lib/auth'
import { getMiembroActual } from './shared'
import { registrarAuditoria } from './auditoria'

// Columnas seguras para exponer al panel (excluyen contrasena_hash).
const COLUMNAS_PUBLICAS = 'id, discord_id, auth_user_id, nombre_completo, correo_institucional, rol, cargo, pilar, estado, codigo_verificacion, creado_en'

// Dado un cargo, devuelve si requiere pilar asignado (`null` si el cargo no existe).
async function cargoRequierePilar(admin: ReturnType<typeof createAdminClient>, cargo: string): Promise<boolean | null> {
  const { data } = await admin.from('roles').select('requiere_pilar').eq('nombre', cargo).maybeSingle()
  return data ? data.requiere_pilar : null
}

// ─── Crear miembro (solo administradores) ─────────────────────────────────
// El código de verificación lo genera automáticamente un trigger en Supabase
// (formato LEAD-0001, LEAD-0002, ...) al dejar la columna en null.
export async function crearMiembro(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isAdmin(perfil)) return { error: 'No tienes permisos de administrador.' }

  const nombre     = (formData.get('nombre_completo') as string ?? '').trim()
  const correo     = (formData.get('correo_institucional') as string ?? '').trim().toLowerCase()
  const cargo      = formData.get('cargo') as string
  const pilarInput = formData.get('pilar') as string
  const contrasena = (formData.get('contrasena') as string ?? '')

  if (!correo.includes('@')) {
    return { error: 'Ingresa un correo válido.' }
  }
  const errorContrasena = validarContrasena(contrasena)
  if (errorContrasena) {
    return { error: errorContrasena }
  }

  const admin = createAdminClient()
  const requierePilar = await cargoRequierePilar(admin, cargo)
  if (requierePilar === null) return { error: 'Cargo inválido.' }
  const pilar = requierePilar ? pilarInput : null

  const { data, error } = await admin
    .from('miembros')
    .insert({
      nombre_completo:      nombre,
      correo_institucional: correo,
      cargo,
      pilar,
      estado:               'APROBADO_ADMIN',
      contrasena_hash:      hashPassword(contrasena),
    })
    .select(COLUMNAS_PUBLICAS)
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'El correo institucional ya está registrado.' : error.message }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'CREAR_MIEMBRO',
    entidad:     'miembro',
    entidadId:   data.id,
    detalles:    { nombre_completo: nombre, correo_institucional: correo, cargo, pilar },
  })

  return { data }
}

// ─── Editar miembro (solo administradores) ────────────────────────────────
export async function editarMiembro(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isAdmin(perfil)) return { error: 'No tienes permisos de administrador.' }

  const miembroId  = formData.get('miembro_id') as string
  const nombre     = (formData.get('nombre_completo') as string ?? '').trim()
  const correo     = (formData.get('correo_institucional') as string ?? '').trim().toLowerCase()
  const cargo      = formData.get('cargo') as string
  const pilarInput = formData.get('pilar') as string

  if (!miembroId) return { error: 'Miembro inválido.' }
  if (!nombre) return { error: 'Ingresa el nombre completo.' }
  if (!correo.includes('@')) return { error: 'Ingresa un correo válido.' }

  const admin = createAdminClient()
  const requierePilar = await cargoRequierePilar(admin, cargo)
  if (requierePilar === null) return { error: 'Cargo inválido.' }
  const pilar = requierePilar ? pilarInput : null

  const { data, error } = await admin
    .from('miembros')
    .update({
      nombre_completo:      nombre,
      correo_institucional: correo,
      cargo,
      pilar,
    })
    .eq('id', miembroId)
    .select(COLUMNAS_PUBLICAS)
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'El correo institucional ya está registrado.' : 'No se pudo actualizar el miembro.' }
  }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ACTUALIZAR_MIEMBRO',
    entidad:     'miembro',
    entidadId:   miembroId,
    detalles:    { nombre_completo: nombre, correo_institucional: correo, cargo, pilar },
  })

  return { data }
}

// ─── Eliminar miembro (solo administradores) ──────────────────────────────
export async function eliminarMiembro(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isAdmin(perfil)) return { error: 'No tienes permisos de administrador.' }

  const miembroId = formData.get('miembro_id') as string
  if (!miembroId) return { error: 'Miembro inválido.' }
  if (miembroId === perfil.id) return { error: 'No puedes eliminar tu propia cuenta.' }

  const admin = createAdminClient()
  const { data: miembro } = await admin
    .from('miembros')
    .select('nombre_completo, correo_institucional')
    .eq('id', miembroId)
    .maybeSingle()

  const { error } = await admin.from('miembros').delete().eq('id', miembroId)

  if (error) return { error: 'No se pudo eliminar al miembro.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'ELIMINAR_MIEMBRO',
    entidad:     'miembro',
    entidadId:   miembroId,
    detalles:    { nombre_completo: miembro?.nombre_completo, correo_institucional: miembro?.correo_institucional },
  })

  return { success: true }
}

// ─── Registro público (sin autenticación) ─────────────────────────────────
// Crea el miembro en estado PENDIENTE con rol/pilar provisionales; un
// administrador debe asignarle pilar/rol definitivos y aprobarlo para que
// pueda iniciar sesión. El código de verificación lo genera automáticamente
// un trigger en Supabase (formato LEAD-0001, LEAD-0002, ...).
export async function registrarMiembro(formData: FormData) {
  const nombre     = (formData.get('nombre_completo') as string ?? '').trim()
  const correo     = (formData.get('correo_institucional') as string ?? '').trim().toLowerCase()
  const contrasena = (formData.get('contrasena') as string ?? '')

  if (!nombre) {
    return { error: 'Ingresa tu nombre completo.' }
  }
  if (!correo.includes('@')) {
    return { error: 'Ingresa un correo válido.' }
  }
  const errorContrasena = validarContrasena(contrasena)
  if (errorContrasena) {
    return { error: errorContrasena }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('miembros')
    .insert({
      nombre_completo:      nombre,
      correo_institucional: correo,
      cargo:                'Member',
      pilar:                'Technological Innovation',
      estado:               'PENDIENTE',
      contrasena_hash:      hashPassword(contrasena),
    })
    .select('codigo_verificacion')
    .single()

  if (error) {
    return { error: error.code === '23505' ? 'Ese correo ya está registrado.' : 'No se pudo completar el registro.' }
  }

  return { data }
}

// ─── Aprobar un miembro pendiente (solo administradores) ──────────────────
export async function aprobarMiembro(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isAdmin(perfil)) return { error: 'No tienes permisos de administrador.' }

  const miembroId  = formData.get('miembro_id') as string
  const cargo      = formData.get('cargo') as string
  const pilarInput = formData.get('pilar') as string

  const admin = createAdminClient()
  const requierePilar = await cargoRequierePilar(admin, cargo)
  if (requierePilar === null) return { error: 'Cargo inválido.' }
  const pilar = requierePilar ? pilarInput : null

  const { error } = await admin
    .from('miembros')
    .update({ cargo, pilar, estado: 'APROBADO_ADMIN' })
    .eq('id', miembroId)

  if (error) return { error: 'No se pudo aprobar al miembro.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'APROBAR_MIEMBRO',
    entidad:     'miembro',
    entidadId:   miembroId,
    detalles:    { cargo, pilar },
  })

  return { success: true }
}

// ─── Restablecer contraseña de un miembro (solo administradores) ──────────
export async function restablecerContrasena(formData: FormData) {
  const perfil = await getMiembroActual()
  if (!isAdmin(perfil)) return { error: 'No tienes permisos de administrador.' }

  const miembroId   = formData.get('miembro_id') as string
  const contrasena  = (formData.get('contrasena') as string ?? '')

  if (!miembroId) {
    return { error: 'Miembro inválido.' }
  }
  const errorContrasena = validarContrasena(contrasena)
  if (errorContrasena) {
    return { error: errorContrasena }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('miembros')
    .update({ contrasena_hash: hashPassword(contrasena) })
    .eq('id', miembroId)

  if (error) return { error: 'No se pudo restablecer la contraseña.' }

  await registrarAuditoria({
    actorId:     perfil.id,
    actorNombre: perfil.nombre_completo,
    accion:      'RESET_PASSWORD',
    entidad:     'miembro',
    entidadId:   miembroId,
    detalles:    {},
  })

  return { success: true }
}

// ─── Cambiar mi propia contraseña ──────────────────────────────────────────
export async function cambiarMiContrasena(formData: FormData) {
  const perfil = await getMiembroActual()

  const actual    = (formData.get('actual') as string ?? '')
  const nueva     = (formData.get('nueva') as string ?? '')
  const confirmar = (formData.get('confirmar') as string ?? '')

  if (!actual || !nueva || !confirmar) {
    return { error: 'Completa todos los campos.' }
  }
  if (nueva !== confirmar) {
    return { error: 'Las contraseñas nuevas no coinciden.' }
  }
  const errorContrasena = validarContrasena(nueva)
  if (errorContrasena) {
    return { error: errorContrasena }
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('miembros')
    .select('contrasena_hash')
    .eq('id', perfil.id)
    .maybeSingle()

  if (!row?.contrasena_hash || !verifyPassword(actual, row.contrasena_hash)) {
    return { error: 'La contraseña actual no es correcta.' }
  }

  const { error } = await admin
    .from('miembros')
    .update({ contrasena_hash: hashPassword(nueva) })
    .eq('id', perfil.id)

  if (error) return { error: 'No se pudo actualizar la contraseña.' }

  return { success: true }
}
