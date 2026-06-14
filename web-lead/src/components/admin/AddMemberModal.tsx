'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Miembro } from '@/types'

type Props = {
  onClose:   () => void
  onSuccess: (newMember: Miembro) => void
}

export default function AddMemberModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    nombre_completo:      '',
    correo_institucional: '',
    discord_id:           '',
    rol:                  'Miembro',
    pilar:                'Innovación Tecnológica',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const supabase = createClient()

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

      // Validación simple de correo institucional
      if (!emailLower.endsWith('@upao.edu.pe')) {
        throw new Error('Debes registrar un correo institucional de la UPAO (@upao.edu.pe).')
      }

      const { data, error: err } = await supabase
        .from('miembros')
        .insert({
          nombre_completo:      form.nombre_completo.trim(),
          correo_institucional: emailLower,
          discord_id:           form.discord_id.trim(),
          rol:                  form.rol,
          pilar:                form.pilar,
          estado:               'PENDIENTE',
        })
        .select('*')
        .single()

      if (err) {
        throw err.code === '23505'
          ? new Error('El correo institucional o el Discord ID ya está registrado.')
          : err
      }

      const mappedMember: Miembro = {
        ...(data as any),
        rol_lead: data.rol === 'President' || data.rol === 'Vice-President' ? data.rol : data.pilar
      }

      onSuccess(mappedMember)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el miembro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">Agregar Miembro</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input
              type="text"
              name="nombre_completo"
              value={form.nombre_completo}
              onChange={handleChange}
              required
              placeholder="Ej: Luis Rodríguez"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Institucional</label>
            <input
              type="email"
              name="correo_institucional"
              value={form.correo_institucional}
              onChange={handleChange}
              required
              placeholder="nombre@upao.edu.pe"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discord ID (Numérico)</label>
            <input
              type="text"
              name="discord_id"
              value={form.discord_id}
              onChange={handleChange}
              required
              placeholder="Ej: 349182390231920"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol / Cargo</label>
              <select
                name="rol"
                value={form.rol}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent bg-white"
              >
                <option value="Miembro">Miembro (Integrante)</option>
                <option value="Leader">Leader (Líder de Área)</option>
                <option value="Chief of Staff">Chief of Staff</option>
                <option value="Treasure / Fundraising">Treasure / Fundraising</option>
                <option value="Vice-President">Vice-President</option>
                <option value="President">President</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilar Oficial</label>
              <select
                name="pilar"
                value={form.pilar}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent bg-white"
              >
                <option value="Innovación Tecnológica">Innovación Tecnológica</option>
                <option value="Desarrollo del Capítulo">Desarrollo del Capítulo</option>
                <option value="Excelencia Académica">Excelencia Académica</option>
                <option value="Liderazgo">Liderazgo</option>
                <option value="Desarrollo Profesional">Desarrollo Profesional</option>
                <option value="Impacto Comunitario">Impacto Comunitario</option>
                <option value="Excelencia Femenina">Excelencia Femenina</option>
                <option value="LEAD Academia">LEAD Academia</option>
                <option value="Dirección">Dirección</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-lead-navy hover:bg-lead-blue disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Guardando...' : 'Agregar miembro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
