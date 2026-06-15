'use client'

import { useState } from 'react'
import Link from 'next/link'
import { registrarMiembro } from '@/lib/actions/miembros'

type Props = { discordUrl?: string | null }

export default function RegistroForm({ discordUrl }: Props) {
  const [nombre, setNombre]       = useState('')
  const [correo, setCorreo]       = useState('')
  const [contrasena, setContrasena] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [codigo, setCodigo]       = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.set('nombre_completo', nombre)
    formData.set('correo_institucional', correo)
    formData.set('contrasena', contrasena)

    const { data, error: err } = await registrarMiembro(formData)

    if (err || !data) {
      setError(err ?? 'No se pudo completar el registro.')
    } else {
      setCodigo(data.codigo_verificacion)
    }
    setLoading(false)
  }

  if (codigo) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-400/30">
          <span className="text-2xl text-green-300">✓</span>
        </div>
        <p className="text-blue-200 text-sm leading-relaxed">
          ¡Registro recibido! Tu cuenta está pendiente de aprobación por un administrador.
          Guarda este código: lo usarás para iniciar sesión (junto con tu contraseña) y
          para vincular tu Discord con <span className="font-mono font-semibold">/verificar</span>.
        </p>
        <div className="bg-white/10 border border-white/20 rounded-xl py-4">
          <span className="text-2xl font-mono font-bold tracking-[0.3em] text-lead-gold">
            {codigo}
          </span>
        </div>
        {discordUrl && (
          <div className="space-y-2">
            <p className="text-blue-200 text-sm leading-relaxed">
              Únete a nuestro servidor de Discord y usa el comando{' '}
              <span className="font-mono font-semibold">/verificar</span> con tu código para vincular tu cuenta.
            </p>
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 rounded-xl transition-colors duration-200 text-sm"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.075.075 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z"/>
              </svg>
              Unirse al servidor de Discord
            </a>
          </div>
        )}
        <Link
          href="/"
          className="block w-full bg-lead-gold hover:bg-lead-crimson text-white font-bold py-3 rounded-xl transition-colors duration-200 text-sm"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-white text-sm font-medium mb-1.5">Nombre completo</label>
        <input
          type="text"
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(null) }}
          required
          placeholder="Ej: Luis Rodríguez"
          className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lead-gold transition"
        />
      </div>

      <div>
        <label className="block text-white text-sm font-medium mb-1.5">Correo</label>
        <input
          type="email"
          value={correo}
          onChange={e => { setCorreo(e.target.value); setError(null) }}
          required
          placeholder="nombre@correo.com"
          className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lead-gold transition"
        />
      </div>

      <div>
        <label className="block text-white text-sm font-medium mb-1.5">Contraseña</label>
        <input
          type="password"
          value={contrasena}
          onChange={e => { setContrasena(e.target.value); setError(null) }}
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres, con letra y número"
          className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lead-gold transition"
        />
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-lead-gold hover:bg-lead-crimson disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors duration-200 text-sm"
      >
        {loading ? 'Enviando...' : 'Registrarme'}
      </button>
    </form>
  )
}
