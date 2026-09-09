import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { getMiembroPerfil } from '@/lib/miembro'

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

  if (code) {
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

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const discordId = user.user_metadata?.provider_id ?? null
        const miembro = await getMiembroPerfil(user.id, discordId)

        // El registro de nuevos miembros es solo por administrador:
        // si esta cuenta de Discord no está vinculada a ningún miembro, no hay acceso.
        if (!miembro) {
          return NextResponse.redirect(`${origin}/?error=not_registered`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Si algo falla, redirigir al login con mensaje de error
  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}
