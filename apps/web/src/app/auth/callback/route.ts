import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { getMiembroPerfil, ErrorDeConfiguracion } from '@/lib/miembro'

// ─── Callback del flujo OAuth de Supabase ─────────────────────────────────
// Discord redirige aquí después de que el usuario autoriza la aplicación.
// Intercambia el código temporal por una sesión persistente.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/admin'

  // Solo se permiten rutas internas relativas (evita open redirect vía
  // "next=@evil.com" o "next=//evil.com", interpretados por el navegador
  // como un host externo).
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/admin'

  // Sin `code` no hubo autorización: Discord o Supabase devolvieron un error.
  // Antes esto acababa en el mismo `auth_failed` que un intercambio fallido,
  // así que tres causas distintas daban el mismo mensaje.
  if (!code) {
    const motivo = searchParams.get('error_description') ?? searchParams.get('error')
    console.error(`[auth/callback] Vuelta sin código de autorización: ${motivo ?? 'sin detalle'}`)
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // El error se registraba en ninguna parte, y su causa más común es una
      // clave pública caducada en el entorno: sin este log, el diagnóstico
      // pasa por descompilar el bundle. Ocurrió el 2026-09-11.
      console.error(`[auth/callback] exchangeCodeForSession falló: ${error.message}`)
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const discordId = user.user_metadata?.provider_id ?? null

      let miembro
      try {
        miembro = await getMiembroPerfil(user.id, discordId)
      } catch (err) {
        // La consulta no se pudo hacer. Decirle a alguien que no está
        // registrado cuando lo que falla es el servidor lo manda a pedir
        // permisos que ya tiene.
        if (err instanceof ErrorDeConfiguracion) {
          console.error(`[auth/callback] ${err.message}`)
          return NextResponse.redirect(`${origin}/?error=config_error`)
        }
        throw err
      }

      // El registro de nuevos miembros es solo por administrador:
      // si esta cuenta de Discord no está vinculada a ningún miembro, no hay acceso.
      if (!miembro) {
        return NextResponse.redirect(`${origin}/?error=not_registered`)
      }
    }

    return NextResponse.redirect(`${origin}${next}`)
  }
}
