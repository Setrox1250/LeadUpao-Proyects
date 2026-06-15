import Link from 'next/link'
import RegistroForm from '@/components/auth/RegistroForm'
import { obtenerRedesSociales } from '@/lib/actions/redesSociales'

export const metadata = {
  title: 'Registro – LEAD UPAO',
  description: 'Regístrate como miembro de LEAD UPAO.',
}

export default async function RegistroPage() {
  const { data: redes } = await obtenerRedesSociales()
  const discordUrl = redes?.find(r => r.plataforma.toLowerCase() === 'discord')?.url ?? null

  return (
    <div className="min-h-screen bg-gradient-to-br from-lead-navy via-lead-blue to-lead-navy flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">LEAD UPAO</h1>
          <p className="text-blue-300 mt-2">Crea tu cuenta de miembro</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 space-y-6 shadow-2xl">
          <RegistroForm discordUrl={discordUrl} />

          <p className="text-center text-blue-300 text-sm">
            ¿Ya tienes cuenta?{' '}
            <Link href="/" className="text-lead-gold hover:underline font-semibold">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
