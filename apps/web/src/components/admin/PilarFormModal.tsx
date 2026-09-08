'use client'

import { useState } from 'react'
import { crearPilar, actualizarPilar } from '@/lib/actions/pilares'
import Modal from '@/components/ui/Modal'
import { FormInput, FormActions } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Pilar } from '@/types'

type Props = {
  initial?:  Pilar
  onClose:   () => void
  onSuccess: (pilar: Pilar) => void
}

export default function PilarFormModal({ initial, onClose, onSuccess }: Props) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '',
    orden:  initial?.orden ?? 0,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { showToast('error', 'El nombre es obligatorio.'); return }

    setLoading(true)

    const formData = new FormData()
    if (initial) formData.set('id', initial.id)
    formData.set('nombre', form.nombre.trim())
    formData.set('orden', String(form.orden))

    const { data, error: err } = initial
      ? await actualizarPilar(formData)
      : await crearPilar(formData)

    if (err || !data) {
      showToast('error', err ?? 'No se pudo guardar el pilar.')
      setLoading(false)
      return
    }

    showToast('success', initial ? 'Pilar actualizado correctamente.' : 'Pilar creado correctamente.')
    onSuccess(data)
  }

  return (
    <Modal onClose={onClose} title={initial ? 'Editar pilar' : 'Nuevo pilar'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Nombre del pilar"
          type="text"
          value={form.nombre}
          onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
          required
          placeholder="Ej: Technological Innovation"
        />

        <FormInput
          label="Orden"
          type="number"
          value={form.orden}
          onChange={e => setForm(prev => ({ ...prev, orden: Number(e.target.value) }))}
          min={0}
        />

        <FormActions onCancel={onClose} loading={loading} submitLabel={initial ? 'Guardar cambios' : 'Crear pilar'} loadingLabel="Guardando..." />
      </form>
    </Modal>
  )
}
