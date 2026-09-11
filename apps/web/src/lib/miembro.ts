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
// Se lanza cuando la consulta NO SE PUDO HACER, para distinguirlo de que la
// persona no esté registrada. Son dos cosas opuestas y antes se confundían.
export class ErrorDeConfiguracion extends Error {
  constructor(detalle: string) {
    super(`No se pudo consultar \`miembros\`: ${detalle}`)
    this.name = 'ErrorDeConfiguracion'
  }
}

export async function getMiembroPerfil(
  userId: string,
  discordId?: string | null
) {
  const admin = createAdminClient()

  const { data: miembro, error } = await admin
    .from('miembros')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle()

  // ─── POR QUÉ ESTO NO SE PUEDE TRAGAR ─────────────────────────────────────
  //
  // Si la consulta falla —clave de servicio caducada, revocada o mal puesta en
  // el entorno— el resultado es `null`, igual que si la persona no existiera.
  // La aplicación lo interpretaba como "no estás registrado" y le decía que
  // hablara con un administrador. Ocurrió en producción el 2026-09-11, tras
  // rotar las claves sin actualizar Vercel, y mandó a buscar un problema de
  // permisos donde había uno de configuración.
  //
  // Un fallo del servidor tiene que sonar como un fallo del servidor.
  if (error) {
    console.error('[getMiembroPerfil] La consulta a `miembros` falló:', error.message)
    throw new ErrorDeConfiguracion(error.message)
  }

  if (miembro) return miembro

  if (discordId) {
    const { data: porDiscord, error: errorDiscord } = await admin
      .from('miembros')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle()

    if (errorDiscord) {
      console.error('[getMiembroPerfil] La búsqueda por discord_id falló:', errorDiscord.message)
      throw new ErrorDeConfiguracion(errorDiscord.message)
    }

    if (porDiscord) {
      await admin.from('miembros').update({ auth_user_id: userId }).eq('id', porDiscord.id)
      return { ...porDiscord, auth_user_id: userId }
    }
  }

  return null
}
