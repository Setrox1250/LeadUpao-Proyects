'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPassword, verifyPassword } from '@/lib/password'

// Hash "señuelo" con costo de cómputo equivalente a un hash real. Se usa
// cuando el código de verificación no existe, para que verifyPassword()
// siempre se ejecute y el tiempo de respuesta no delate qué códigos
// LEAD-XXXX existen en la base de datos (canal de tiempo / enumeración).
const DUMMY_HASH = hashPassword('dummy-constant-do-not-use')

// Login alterno con "Código de verificación" + "Contraseña".
// El código lo genera automáticamente Supabase al crear al miembro (Gestión de Miembros)
// y también se usa en Discord con /verificar para vincular la cuenta.
// La contraseña la define el administrador al crear el miembro y el propio
// miembro puede cambiarla luego desde el panel.
export async function loginWithCode(formData: FormData) {
  const codigo     = (formData.get('codigo_verificacion') as string ?? '').trim().toUpperCase()
  const contrasena = (formData.get('contrasena') as string ?? '')

  if (!codigo || !contrasena) {
    redirect('/?error=missing_fields')
  }

  const admin = createAdminClient()

  const { data: miembro } = await admin
    .from('miembros')
    .select('*')
    .eq('codigo_verificacion', codigo)
    .maybeSingle()

  // Siempre se ejecuta verifyPassword (con el hash real o el señuelo) para
  // que el costo de cómputo sea constante exista o no el código.
  const hashParaVerificar = miembro?.contrasena_hash ?? DUMMY_HASH
  const contrasenaValida = verifyPassword(contrasena, hashParaVerificar)

  if (!miembro || !contrasenaValida) {
    redirect('/?error=invalid_code')
  }

  if (miembro.estado === 'PENDIENTE') {
    redirect('/?error=pending_approval')
  }

  const estadoValido = miembro.estado === 'APROBADO_ADMIN' || miembro.estado === 'VERIFICADO'

  if (!estadoValido) {
    redirect('/?error=invalid_code')
  }

  // Generar un enlace de acceso (crea el usuario de Auth si aún no existe)
  // y consumirlo de inmediato para abrir una sesión real, sin enviar correos.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: miembro.correo_institucional,
  })

  const hashedToken = linkData?.properties?.hashed_token

  if (linkError || !hashedToken) {
    console.error('[loginWithCode] No se pudo generar el enlace de acceso:', linkError)
    redirect('/?error=login_failed')
  }

  const supabase = await createClient()
  const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashedToken,
  })

  if (verifyError || !sessionData.user) {
    console.error('[loginWithCode] No se pudo crear la sesión:', verifyError)
    redirect('/?error=login_failed')
  }

  if (miembro.auth_user_id !== sessionData.user.id) {
    await admin.from('miembros').update({ auth_user_id: sessionData.user.id }).eq('id', miembro.id)
  }

  redirect('/admin')
}
