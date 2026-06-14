'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PILARES } from '@/lib/constants'

type Props = {
  discordId:   string
  discordName: string
}

type FormState = {
  nombre_completo:      string
  correo_institucional: string
  rol_lead:             string
}

export default function RegistroForm({ discordId, discordName }: Props) {
  const [form, setForm] = useState<FormState>({
    nombre_completo:      discordName,
    correo_institucional: '',
    rol_lead:             '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const emailLower = form.correo_institucional.trim().toLowerCase()

      // Validación del correo institucional
      if (!emailLower.endsWith('@upao.edu.pe')) {
        throw new Error('Debes registrar un correo institucional válido de la UPAO (@upao.edu.pe).')
      }

      const { error: insertError } = await supabase
        .from('miembros')
        .insert({
          discord_id:           discordId,
          nombre_completo:      form.nombre_completo.trim(),
          correo_institucional: emailLower,
          rol:                  'Miembro',
          pilar:                form.rol_lead,
          estado:               'PENDIENTE',
        })

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Este correo institucional o cuenta de Discord ya está registrada.')
        }
        throw insertError
      }

      setSuccess(true)
      router.refresh() // Refresca el Server Component para detectar el nuevo estado PENDIENTE
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
          <span className="text-2xl text-green-400">✓</span>
        </div>
        <h3 className="text-xl font-bold text-white">¡Registro Enviado!</h3>
        <p className="text-blue-200 text-sm leading-relaxed">
          Tu solicitud ha sido guardada con éxito en el sistema. Ahora la directiva o el pilar de <strong>Innovación Tecnológica</strong> evaluará tu ingreso.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 space-y-5"
    >
      {/* Nombre completo */}
      <div>
        <label className="block text-white text-sm font-medium mb-1.5">Nombre Completo</label>
        <input
          type="text"
          name="nombre_completo"
          value={form.nombre_completo}
          onChange={handleChange}
          placeholder="Ej: Ana García López"
          required
          className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lead-gold transition"
        />
      </div>

      {/* Correo institucional */}
      <div>
        <label className="block text-white text-sm font-medium mb-1.5">Correo Institucional</label>
        <input
          type="email"
          name="correo_institucional"
          value={form.correo_institucional}
          onChange={handleChange}
          placeholder="nombre@upao.edu.pe"
          required
          className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lead-gold transition"
        />
        <p className="text-[10px] text-blue-300 mt-1.5">Solo correos con dominio @upao.edu.pe</p>
      </div>

      {/* Pilar */}
      <div>
        <label className="block text-white text-sm font-medium mb-1.5">Pilar Oficial</label>
        <select
          name="rol_lead"
          value={form.rol_lead}
          onChange={handleChange}
          required
          className="w-full bg-lead-navy border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lead-gold transition appearance-none cursor-pointer"
        >
          <option value="" disabled>Selecciona tu pilar...</option>
          {PILARES.map(pilar => (
            <option key={pilar} value={pilar}>{pilar}</option>
          ))}
        </select>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-lead-gold hover:bg-lead-crimson disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors duration-200 text-base"
      >
        {loading ? 'Registrando...' : 'Enviar Solicitud de Registro →'}
      </button>
    </form>
  )
}
