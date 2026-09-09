import { createClient } from '@supabase/supabase-js'

// Cliente con privilegios de servicio (service_role) — SOLO para uso server-side
// (Server Actions, Route Handlers). NUNCA importar desde un componente 'use client'.
//
// ─── POR QUÉ VALIDA LA CLAVE ───────────────────────────────────────────────
//
// Poner aquí por error la clave PUBLICABLE es un fallo silencioso y difícil de
// diagnosticar: el cliente se construye igual, pero cada consulta corre con
// permisos de anónimo. Como `miembros` está cerrada a las claves públicas, la
// resolución de identidad devuelve null y la aplicación responde "Tu cuenta no
// está registrada como miembro" a usuarios que sí lo están.
//
// Antes de cerrar la tabla, esa confusión quedaba enmascarada porque una
// consulta anónima sobre `miembros` funcionaba.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL en el entorno del servidor.')
  }
  if (!key) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor. ' +
      'Sin ella no se puede resolver la identidad de los miembros.'
    )
  }
  if (key.startsWith('sb_publishable_') || key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY contiene la clave PUBLICABLE, no la secreta. ' +
      'Usa la clave "secret" de Supabase → Settings → API Keys (empieza por sb_secret_).'
    )
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
