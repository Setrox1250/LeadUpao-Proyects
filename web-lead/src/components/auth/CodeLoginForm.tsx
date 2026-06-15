'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { loginWithCode } from '@/app/login-actions'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-lead-gold hover:bg-lead-crimson disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors duration-200 text-sm"
    >
      {pending ? 'Verificando...' : 'Ingresar con código'}
    </button>
  )
}

export default function CodeLoginForm() {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={loginWithCode} className="space-y-4">
      <div>
        <label className="block text-white text-sm font-medium mb-1.5">Código de verificación</label>
        <input
          type="text"
          name="codigo_verificacion"
          required
          placeholder="Ej: LEAD-0001"
          className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lead-gold transition uppercase tracking-widest font-mono"
        />
      </div>

      <div>
        <label className="block text-white text-sm font-medium mb-1.5">Contraseña</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            name="contrasena"
            required
            placeholder="••••••••"
            className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 rounded-xl px-4 py-3 pr-11 focus:outline-none focus:ring-2 focus:ring-lead-gold transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white transition-colors"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}
