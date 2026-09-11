import Link from 'next/link'
import RecuperarForm from '@/components/auth/RecuperarForm'

export const metadata = {
  title: 'Recuperar contraseña – LEAD UPAO',
  description: 'Restablece tu contraseña con un código enviado por Discord.',
}

export default function RecuperarPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-lead-navy via-lead-blue to-lead-navy flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-extrabold text-white tracking-tight">
            LEAD UPAO
          </Link>
          <p className="text-blue-200 text-sm mt-1">Recuperar contraseña</p>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl p-6 shadow-xl">
          <RecuperarForm />
        </div>
      </div>
    </div>
  )
}
