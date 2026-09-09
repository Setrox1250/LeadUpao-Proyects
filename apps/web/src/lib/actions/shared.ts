import { createClient } from '@/lib/supabase/server'
import { getMiembroPerfil } from '@/lib/miembro'

// Resuelve el perfil de 'miembros' del usuario autenticado actual.
// Punto único de verdad usado por todas las Server Actions que requieren
// identificar al actor (para RBAC y para el log de auditoría).
export async function getMiembroActual() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado.')

  const discordId = user.user_metadata?.provider_id ?? null
  const perfil = await getMiembroPerfil(user.id, discordId)
  if (!perfil) throw new Error('No autenticado.')

  return perfil
}
