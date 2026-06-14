'use client'

import { useState } from 'react'
import { createClient }                from '@/lib/supabase/client'
import { PILARES, ETIQUETAS_TAREA, ETIQUETA_COLORS } from '@/lib/constants'
import type { Tarea } from '@/types'

type Props = {
  onClose:        () => void
  onSuccess:      (newTask: Tarea) => void
  defaultPilar:   string
  canChangePilar: boolean
}

export default function CreateTaskModal({ onClose, onSuccess, defaultPilar, canChangePilar }: Props) {
  const [form, setForm] = useState({ titulo: '', descripcion: '', pilar: defaultPilar })
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const supabase = createClient()

  const toggleEtiqueta = (tag: string) => {
    setEtiquetas(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { setError('El título es obligatorio.'); return }

    setLoading(true)
    setError(null)

    try {
      const { data, error: err } = await supabase
        .from('tareas')
        .insert({
          titulo:      form.titulo.trim(),
          descripcion: form.descripcion.trim() || null,
          pilar:       form.pilar,
          etiquetas,
          estado:      'BACKLOG',
        })
        .select('*')
        .single()

      if (err) throw err

      onSuccess(data as Tarea)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear la tarea.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Nueva Tarea</h3>
            <p className="text-xs text-gray-400 mt-0.5">Se creará en Backlog y se sincronizará con Discord</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="titulo"
              value={form.titulo}
              onChange={handleChange}
              required
              maxLength={100}
              placeholder="Ej: Preparar informe mensual de actividades"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={3}
              placeholder="Detalla el objetivo o contexto de la tarea (se publicará en el hilo de Discord)..."
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent resize-none"
            />
          </div>

          {/* Pilar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilar Asociado</label>
            {canChangePilar ? (
              <select
                name="pilar"
                value={form.pilar}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent bg-white"
              >
                {PILARES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <div className="border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 text-sm text-gray-600 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
                {form.pilar}
              </div>
            )}
          </div>

          {/* Etiquetas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Etiquetas
              <span className="ml-1 font-normal text-gray-400">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS_TAREA.map(tag => {
                const isSelected  = etiquetas.includes(tag)
                const colorClass  = ETIQUETA_COLORS[tag]
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleEtiqueta(tag)}
                    className={`
                      text-xs font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none
                      ${isSelected
                        ? `${colorClass} ring-2 ring-offset-1 ring-current shadow-sm`
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600'
                      }
                    `}
                  >
                    {isSelected && <span className="mr-1">✓</span>}
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Acciones */}
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
              {loading ? 'Creando...' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
