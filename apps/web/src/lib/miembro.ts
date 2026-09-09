import { createAdminClient } from '@/lib/supabase/admin'

// Resuelve el registro de 'miembros' asociado al usuario de Supabase Auth.
// 1. Busca por auth_user_id (vínculo directo, login con Discord o con código).
// 2. Si no existe, intenta vincular por discord_id (usuarios que ya estaban
//    verificados antes de esta migración) y autocompleta auth_user_id.
//
// ─── POR QUÉ USA service_role Y NO LA CLAVE PÚBLICA ────────────────────────
//
// `miembros` tiene RLS y no concede nada a `anon` ni a `authenticated`
// (ver supabase/hotfix/README.md). Esta función no podría trabajar con la clave
// pública ni aunque hubiera una política de "solo tu propia fila": el paso 2
// busca por `discord_id` una fila cuyo `auth_user_id` todavía es null, así que
// ninguna política basada en auth.uid() la alcanza.
//
// Es seguro porque solo se invoca desde el servidor y con un `userId` que ya
// viene de `supabase.auth.getUser()`, es decir, de una sesión verificada. La
// función devuelve exclusivamente la ficha de ese usuario: no expone filas
// ajenas ni acepta un identificador elegido por el cliente.
export async function getMiembroPerfil(
  userId: string,
  discordId?: string | null
) {
  const admin = createAdminClient()

  const { data: miembro } = await admin
    .from('miembros')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (miembro) return miembro

  if (discordId) {
    const { data: porDiscord } = await admin
      .from('miembros')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle()

    if (porDiscord) {
      await admin.from('miembros').update({ auth_user_id: userId }).eq('id', porDiscord.id)
      return { ...porDiscord, auth_user_id: userId }
    }
  }

  return null
}
