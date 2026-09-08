'use client'

import { useState } from 'react'
import { editarMiembro } from '@/lib/actions/miembros'
import Modal from '@/components/ui/Modal'
import { FormInput, FormSelect, FormActions } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Miembro, Rol, Pilar } from '@/types'

type Props = {
  miembro:   Miembro
  roles:     Rol[]
  pilares:   Pilar[]
  onClose:   () => void
  onSuccess: (updated: Miembro) => void
}

export default function EditMemberModal({ miembro, roles, pilares, onClose, onSuccess }: Props) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    nombre_completo:      miembro.nombre_completo,
    correo_institucional: miembro.correo_institucional,
    cargo:                miembro.cargo,
    pilar:                miembro.pilar ?? pilares[0]?.nombre ?? '',
  })
  const [loading, setLoading] = useState(false)

  const cargoActual   = roles.find(r => r.nombre === form.cargo)
  const requierePilar = cargoActual?.requiere_pilar ?? false

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'cargo') {
        const nuevoCargo = roles.find(r => r.nombre === value)
        next.pilar = nuevoCargo?.requiere_pilar ? (prev.pilar || (pilares[0]?.nombre ?? '')) : ''
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData()
      formData.set('miembro_id', miembro.id)
      formData.set('nombre_completo', form.nombre_completo.trim())
      formData.set('correo_institucional', form.correo_institucional.trim().toLowerCase())
      formData.set('cargo', form.cargo)
      formData.set('pilar', form.pilar)

      const { data, error: err } = await editarMiembro(formData)

      if (err || !data) {
        throw new Error(err ?? 'Error al actualizar el miembro.')
      }

      const updated: Miembro = {
        ...(data as any),
        rol_lead: data.pilar || data.cargo,
      }

      showToast('success', 'Miembro actualizado correctamente.')
      onSuccess(updated)
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Error al actualizar el miembro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Editar Miembro" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Nombre Completo"
          type="text"
          name="nombre_completo"
          value={form.nombre_completo}
          onChange={handleChange}
          required
          placeholder="Ej: Luis Rodríguez"
        />

        <FormInput
          label="Correo"
          type="email"
          name="correo_institucional"
          value={form.correo_institucional}
          onChange={handleChange}
          required
          placeholder="nombre@correo.com"
        />

        <div className={`grid gap-4 ${requierePilar ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <FormSelect label="Cargo" name="cargo" value={form.cargo} onChange={handleChange} required>
            {roles.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
          </FormSelect>

          {requierePilar && (
            <FormSelect label="Pilar" name="pilar" value={form.pilar} onChange={handleChange} required>
              {pilares.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            </FormSelect>
          )}
        </div>

        <FormActions onCancel={onClose} loading={loading} submitLabel="Guardar cambios" loadingLabel="Guardando..." />
      </form>
    </Modal>
  )
}
