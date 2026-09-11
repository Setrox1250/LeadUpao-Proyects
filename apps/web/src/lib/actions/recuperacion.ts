'use server'

import { randomInt } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPassword, verifyPassword, validarContrasena } from '@/lib/password'
import { enviarCodigoRecuperacion } from './discordSync'
import { registrarAuditoria } from './auditoria'

// ─── Recuperación de contraseña sin sesión ───────────────────────────────
//
// Es el único camino de la plataforma que escribe en `miembros` sin que haya
// nadie autenticado, así que todo lo de aquí asume hostilidad.
//
// Reglas, y el porqué de cada una:
//
//   · El código se guarda HASHEADO. Quien lea la base no debe poder entrar con
//     lo que encuentre allí, igual que con las contraseñas.
//   · Caduca en 15 minutos y solo sirve una vez.
//   · Cinco intentos fallidos lo invalidan. Seis dígitos son un millón de
//     combinaciones: sin contador, se agotan solos.
//   · Las respuestas NO revelan si un código de verificación existe. Un
//     LEAD-XXXX válido más una contraseña es un inicio de sesión, así que
//     poder enumerarlos es media credencial regalada.

const VIGENCIA_MINUTOS = 15
const MAX_INTENTOS     = 5

// Evita que pedir el código sea un botón para bombardear a alguien a mensajes
// directos: mientras el anterior siga fresco, no se emite otro.
const REEMISION_SEGUNDOS = 60

// Mismo señuelo que en el login con código: verifyPassword se ejecuta siempre,
// exista o no el código, para que el tiempo de respuesta no delate cuáles son
// válidos.
const HASH_SENUELO = hashPassword('senuelo-recuperacion-no-usar')

// Una sola respuesta para todos los desenlaces de la solicitud. Si dijera
// «ese código no existe», enumerarlos sería cuestión de un bucle.
const RESPUESTA_GENERICA =
  'Si el código pertenece a una cuenta con Discord vinculado, te acabamos de ' +
  'enviar un mensaje directo con un código de 6 dígitos. Caduca en ' +
  `${VIGENCIA_MINUTOS} minutos.`

function normalizarCodigoMiembro(valor: FormDataEntryValue | null): string {
  return String(valor ?? '').trim().toUpperCase()
}

// ─── Paso 1: pedir el código ─────────────────────────────────────────────
export async function solicitarRecuperacion(
  formData: FormData
): Promise<{ mensaje: string; error?: string }> {
  const codigoMiembro = normalizarCodigoMiembro(formData.get('codigo_verificacion'))
  if (!codigoMiembro) {
    return { mensaje: '', error: 'Escribe tu código de verificación.' }
  }

  const admin = createAdminClient()
  const { data: miembro } = await admin
    .from('miembros')
    .select('id, nombre_completo, discord_id, estado, recuperacion_expira_en')
    .eq('codigo_verificacion', codigoMiembro)
    .maybeSingle()

  const estadoValido = miembro?.estado === 'APROBADO_ADMIN' || miembro?.estado === 'VERIFICADO'

  if (!miembro || !miembro.discord_id || !estadoValido) {
    // Silencio deliberado. Quien no tiene Discord vinculado no puede recibir
    // el código, y decírselo aquí revelaría que su código sí existe.
    console.warn(`[recuperacion] Solicitud sin destino para "${codigoMiembro}".`)
    return { mensaje: RESPUESTA_GENERICA }
  }

  // ¿Hay uno reciente todavía vivo? Se deduce de la caducidad: un código
  // emitido hace menos de REEMISION_SEGUNDOS caduca casi dentro de la ventana
  // completa.
  const expira = miembro.recuperacion_expira_en ? Date.parse(miembro.recuperacion_expira_en) : 0
  const emitidoHace = VIGENCIA_MINUTOS * 60_000 - (expira - Date.now())
  if (expira > Date.now() && emitidoHace < REEMISION_SEGUNDOS * 1000) {
    return { mensaje: RESPUESTA_GENERICA }
  }

  // randomInt del módulo crypto, no Math.random: esto es una credencial.
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')

  const { error } = await admin
    .from('miembros')
    .update({
      recuperacion_hash:      hashPassword(codigo),
      recuperacion_expira_en: new Date(Date.now() + VIGENCIA_MINUTOS * 60_000).toISOString(),
      recuperacion_intentos:  0,
    })
    .eq('id', miembro.id)

  if (error) {
    console.error('[recuperacion] No se pudo guardar el código:', error.message)
    return { mensaje: '', error: 'No se pudo iniciar la recuperación. Inténtalo más tarde.' }
  }

  const envio = await enviarCodigoRecuperacion(
    miembro.discord_id,
    codigo,
    miembro.nombre_completo.split(' ')[0],
    VIGENCIA_MINUTOS,
  )

  if (!envio.ok) {
    // No se distingue del caso feliz a propósito. El motivo más común es tener
    // cerrados los mensajes directos, y eso ya se explica en la pantalla.
    console.error(`[recuperacion] No se pudo enviar el código: ${envio.aviso}`)
  }

  return { mensaje: RESPUESTA_GENERICA }
}

// ─── Paso 2: canjear el código por una contraseña nueva ──────────────────
export async function restablecerConCodigo(
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  const codigoMiembro = normalizarCodigoMiembro(formData.get('codigo_verificacion'))
  const codigo        = String(formData.get('codigo') ?? '').trim()
  const nueva         = String(formData.get('nueva') ?? '')
  const confirmar     = String(formData.get('confirmar') ?? '')

  if (!codigoMiembro || !codigo) {
    return { error: 'Completa todos los campos.' }
  }
  if (nueva !== confirmar) {
    return { error: 'Las contraseñas no coinciden.' }
  }
  // La política se valida ANTES de tocar la base: no gasta un intento por
  // escribir una contraseña corta, que sería castigar el error equivocado.
  const errorContrasena = validarContrasena(nueva)
  if (errorContrasena) return { error: errorContrasena }

  const admin = createAdminClient()
  const { data: miembro } = await admin
    .from('miembros')
    .select('id, nombre_completo, recuperacion_hash, recuperacion_expira_en, recuperacion_intentos')
    .eq('codigo_verificacion', codigoMiembro)
    .maybeSingle()

  const vigente = Boolean(
    miembro?.recuperacion_hash &&
    miembro.recuperacion_expira_en &&
    Date.parse(miembro.recuperacion_expira_en) > Date.now() &&
    (miembro.recuperacion_intentos ?? 0) < MAX_INTENTOS
  )

  // Siempre se verifica algo, haya código o no: el costo de cómputo no debe
  // delatar qué códigos de miembro existen.
  const acierta = verifyPassword(codigo, vigente ? miembro!.recuperacion_hash! : HASH_SENUELO)

  if (!vigente || !acierta) {
    if (miembro && vigente) {
      const intentos = (miembro.recuperacion_intentos ?? 0) + 1
      await admin
        .from('miembros')
        .update(intentos >= MAX_INTENTOS
          // Agotado: se quema el código entero, no solo el intento.
          ? { recuperacion_intentos: intentos, recuperacion_hash: null, recuperacion_expira_en: null }
          : { recuperacion_intentos: intentos })
        .eq('id', miembro.id)
    }
    return { error: 'El código no es válido o ha caducado. Pide uno nuevo.' }
  }

  const { error } = await admin
    .from('miembros')
    .update({
      contrasena_hash:        hashPassword(nueva),
      recuperacion_hash:      null,
      recuperacion_expira_en: null,
      recuperacion_intentos:  0,
    })
    .eq('id', miembro!.id)

  if (error) {
    console.error('[recuperacion] No se pudo guardar la contraseña:', error.message)
    return { error: 'No se pudo actualizar la contraseña. Inténtalo más tarde.' }
  }

  // Se registra sin sesión, con el propio miembro como actor: un cambio de
  // contraseña hecho desde fuera es justo lo que hay que poder revisar luego.
  await registrarAuditoria({
    actorId:     miembro!.id,
    actorNombre: miembro!.nombre_completo,
    accion:      'RECUPERAR_CONTRASENA',
    entidad:     'miembro',
    entidadId:   miembro!.id,
    detalles:    { via: 'codigo_discord' },
  })

  return { success: true }
}
