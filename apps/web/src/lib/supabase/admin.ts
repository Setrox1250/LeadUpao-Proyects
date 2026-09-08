import { createClient } from '@supabase/supabase-js'

// Cliente con privilegios de servicio (service_role) — SOLO para uso server-side
// (Server Actions, Route Handlers). NUNCA importar desde un componente 'use client'.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
