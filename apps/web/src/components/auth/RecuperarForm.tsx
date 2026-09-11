'use client'

import { useState } from 'react'
import Link from 'next/link'
import { solicitarRecuperacion, restablecerConCodigo } from '@/lib/actions/recuperacion'

const CAMPO =
  'w-full bg-white/10 border border-white/20 text-white placeholder-blue-200/50 rounded-xl px-4 py-3 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-lead-gold focus:border-transparent'

const BOTON =
  'w-full bg-lead-gold hover:bg-lead-crimson disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm'

export default function RecuperarForm() {
  // 'pedir' → escribes tu LEAD-XXXX. 'canjear' → llega el código por Discord.
  const [paso, setPaso]         = useState<'pedir' | 'canjear' | 'hecho'>('pedir')
  const [codigoMiembro, setCodigoMiembro] = useState('')
  const [codigo, setCodigo]     = useState('')
  const [nueva, setNueva]       = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [aviso, setAviso]       = useState('')
  const [error, setError]       = useState('')
  const [cargando, setCargando] = useState(false)

  const pedir = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true); setError('')

    const fd = new FormData()
    fd.set('codigo_verificacion', codigoMiembro)
    const r = await solicitarRecuperacion(fd)

    if (r.error) setError(r.error)
    else { setAviso(r.mensaje); setPaso('canjear') }
    setCargando(false)
  }

  const canjear = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true); setError('')

    const fd = new FormData()
    fd.set('codigo_verificacion', codigoMiembro)
    fd.set('codigo', codigo)
    fd.set('nueva', nueva)
    fd.set('confirmar', confirmar)
    const r = await restablecerConCodigo(fd)

    if (r.error) setError(r.error)
    else setPaso('hecho')
    setCargando(false)
  }

  if (paso === 'hecho') {
    return (
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 bg-green-400/20 border border-green-300/40 rounded-full flex items-center justify-center mx-auto">
          <span className="text-2xl text-green-300">✓</span>
        </div>
        <p className="text-white text-sm">Tu contraseña quedó actualizada.</p>
        <Link href="/" className={`${BOTON} block text-center`}>Ir a iniciar sesión</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-200 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      {paso === 'pedir' ? (
        <form onSubmit={pedir} className="space-y-4">
          <div>
            <label htmlFor="codigo_miembro" className="block text-white text-sm font-medium mb-1.5">
              Tu código de verificación
            </label>
            <input
              id="codigo_miembro"
              type="text"
              value={codigoMiembro}
              onChange={e => setCodigoMiembro(e.target.value)}
              placeholder="EJ: LEAD-0001"
              required
              autoFocus
              className={`${CAMPO} font-mono tracking-wider`}
            />
            <p className="text-xs text-blue-200/70 mt-1.5">
              El mismo con el que entras al panel. Te enviaremos un código por mensaje
              directo de Discord.
            </p>
          </div>
          <button type="submit" disabled={cargando} className={BOTON}>
            {cargando ? 'Enviando...' : 'Enviarme el código'}
          </button>
        </form>
      ) : (
        <form onSubmit={canjear} className="space-y-4">
          {aviso && (
            <p className="text-sm text-blue-100 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 leading-relaxed">
              {aviso}
            </p>
          )}

          <div>
            <label htmlFor="codigo" className="block text-white text-sm font-medium mb-1.5">
              Código recibido
            </label>
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={codigo}
              onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              required
              autoFocus
              className={`${CAMPO} font-mono text-center text-2xl tracking-[0.4em]`}
            />
          </div>

          <div>
            <label htmlFor="nueva" className="block text-white text-sm font-medium mb-1.5">
              Contraseña nueva
            </label>
            <input
              id="nueva" type="password" value={nueva} onChange={e => setNueva(e.target.value)}
              required minLength={8} placeholder="Mínimo 8 caracteres, con letra y número"
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="confirmar" className="block text-white text-sm font-medium mb-1.5">
              Repite la contraseña
            </label>
            <input
              id="confirmar" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
              required minLength={8} className={CAMPO}
            />
          </div>

          <button type="submit" disabled={cargando} className={BOTON}>
            {cargando ? 'Guardando...' : 'Cambiar contraseña'}
          </button>

          <button
            type="button"
            onClick={() => { setPaso('pedir'); setCodigo(''); setError('') }}
            className="w-full text-blue-200 hover:text-white text-xs transition-colors"
          >
            No me llegó · pedir otro código
          </button>
        </form>
      )}

      <p className="text-xs text-blue-200/70 text-center leading-relaxed">
        ¿No te llega? Revisa que aceptes mensajes directos de miembros del servidor.
        Si no tienes Discord vinculado, pídele a un administrador que te la restablezca.
      </p>

      <Link href="/" className="block text-center text-blue-200 hover:text-white text-xs transition-colors">
        ← Volver a iniciar sesión
      </Link>
    </div>
  )
}
