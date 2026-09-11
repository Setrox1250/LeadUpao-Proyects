'use client'

import { useState } from 'react'
import { crearTarea }                  from '@/lib/actions/tareas'
import { ETIQUETAS_TAREA, ETIQUETA_COLORS, SIN_AREA } from '@/lib/constants'
import { esFechaValida } from '@/lib/fechas'
import Modal from '@/components/ui/Modal'
import { FormInput, FormSelect, FormTextarea, FormActions } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Tarea, Pilar } from '@/types'

type Props = {
  onClose:        () => void
  onSuccess:      (newTask: Tarea) => void
  defaultPilar:   string
  canChangePilar: boolean
  pilares:        Pilar[]
}

export default function CreateTaskModal({ onClose, onSuccess, defaultPilar, canChangePilar, pilares }: Props) {
  const { showToast } = useToast()
  // `pilar: ''` significa tarea general (sin área): va al foro general de
  // Discord y la ve todo el mundo. Se guarda como NULL.
  const [form, setForm] = useState({
    titulo: '', descripcion: '', pilar: defaultPilar, fecha_vencimiento: '',
  })
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [loading, setLoading]     = useState(false)

  const toggleEtiqueta = (tag: string) => {
    setEtiquetas(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) { showToast('error', 'El título es obligatorio.'); return }
    if (form.fecha_vencimiento && !esFechaValida(form.fecha_vencimiento)) {
      showToast('error', 'La fecha de entrega no es válida.'); return
    }

    setLoading(true)

    try {
      const { data, error: err } = await crearTarea({
        titulo:      form.titulo,
        descripcion: form.descripcion,
        pilar:       form.pilar || null,
        etiquetas,
        fecha_vencimiento: form.fecha_vencimiento || null,
      })

      if (err || !data) {
        throw new Error(err ?? 'Error al crear la tarea.')
      }

      onSuccess(data)
      showToast('success', 'Tarea creada correctamente.')
      onClose()
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Error al crear la tarea.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Nueva Tarea"
      description="Se creará en Backlog y se sincronizará con Discord"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label={<>Título <span className="text-red-500">*</span></>}
          type="text"
          name="titulo"
          value={form.titulo}
          onChange={handleChange}
          required
          maxLength={100}
          placeholder="Ej: Preparar informe mensual de actividades"
        />

        <FormTextarea
          label="Descripción"
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          rows={3}
          placeholder="Detalla el objetivo o contexto de la tarea (se publicará en el hilo de Discord)..."
        />

        {canChangePilar ? (
          <FormSelect label="Pilar Asociado" name="pilar" value={form.pilar} onChange={handleChange}>
            <option value="">{SIN_AREA} (sin área — foro general)</option>
            {pilares.map(p => (
              <option key={p.id} value={p.nombre}>{p.nombre}</option>
            ))}
          </FormSelect>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilar Asociado</label>
            <div className="border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 text-sm text-gray-600 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              {form.pilar || `${SIN_AREA} (sin área)`}
            </div>
          </div>
        )}

        <FormInput
          label={<>Fecha de entrega <span className="font-normal text-gray-400">(opcional)</span></>}
          type="date"
          name="fecha_vencimiento"
          value={form.fecha_vencimiento}
          onChange={handleChange}
          hint="Se usa para ordenar el tablero y para avisar de tareas vencidas."
        />

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

        <FormActions onCancel={onClose} loading={loading} submitLabel="Crear tarea" loadingLabel="Creando..." />
      </form>
    </Modal>
  )
}
