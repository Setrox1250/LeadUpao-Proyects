import type { SupabaseClient } from '@supabase/supabase-js'

// Resuelve el registro de 'miembros' asociado al usuario de Supabase Auth.
// 1. Busca por auth_user_id (vínculo directo, login con Discord o con código).
// 2. Si no existe, intenta vincular por discord_id (usuarios que ya estaban
//    verificados antes de esta migración) y autocompleta auth_user_id.
export async function getMiembroPerfil(
  supabase: SupabaseClient,
  userId: string,
  discordId?: string | null
) {
  const { data: miembro } = await supabase
    .from('miembros')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (miembro) return miembro

  if (discordId) {
    const { data: porDiscord } = await supabase
      .from('miembros')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle()

    if (porDiscord) {
      await supabase.from('miembros').update({ auth_user_id: userId }).eq('id', porDiscord.id)
      return { ...porDiscord, auth_user_id: userId }
    }
  }

  return null
}
