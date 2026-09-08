'use client'

import { useState } from 'react'
import { crearRol, actualizarRol } from '@/lib/actions/roles'
import Modal from '@/components/ui/Modal'
import { FormInput, FormSelect, FormActions } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Rol, NivelPermiso } from '@/types'

type Props = {
  initial?:  Rol
  onClose:   () => void
  onSuccess: (rol: Rol) => void
}

const NIVEL_OPTIONS: { value: NivelPermiso; label: string }[] = [
  { value: 'admin',   label: 'Administrador (permisos administrativos)' },
  { value: 'staff',   label: 'Staff' },
  { value: 'member',  label: 'Miembro común' },
]

export default function RoleFormModal({ initial, onClose, onSuccess }: Props) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    nombre:         initial?.nombre ?? '',
    nivel_permiso:  initial?.nivel_permiso ?? 'member' as NivelPermiso,
    requiere_pilar: initial?.requiere_pilar ?? false,
    orden:          initial?.orden ?? 0,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { showToast('error', 'El nombre es obligatorio.'); return }

    setLoading(true)

    const formData = new FormData()
    if (initial) formData.set('id', initial.id)
    formData.set('nombre', form.nombre.trim())
    formData.set('nivel_permiso', form.nivel_permiso)
    formData.set('orden', String(form.orden))
    if (form.requiere_pilar) formData.set('requiere_pilar', 'on')

    const { data, error: err } = initial
      ? await actualizarRol(formData)
      : await crearRol(formData)

    if (err || !data) {
      showToast('error', err ?? 'No se pudo guardar el rol.')
      setLoading(false)
      return
    }

    showToast('success', initial ? 'Rol actualizado correctamente.' : 'Rol creado correctamente.')
    onSuccess(data)
  }

  return (
    <Modal onClose={onClose} title={initial ? 'Editar rol' : 'Nuevo rol'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Nombre del cargo"
          type="text"
          value={form.nombre}
          onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
          required
          placeholder="Ej: Leader"
        />

        <FormSelect
          label="Nivel de permiso"
          value={form.nivel_permiso}
          onChange={e => setForm(prev => ({ ...prev, nivel_permiso: e.target.value as NivelPermiso }))}
          required
        >
          {NIVEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </FormSelect>

        <FormInput
          label="Orden"
          type="number"
          value={form.orden}
          onChange={e => setForm(prev => ({ ...prev, orden: Number(e.target.value) }))}
          min={0}
        />

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={form.requiere_pilar}
            onChange={e => setForm(prev => ({ ...prev, requiere_pilar: e.target.checked }))}
            className="rounded border-gray-300 text-lead-blue focus:ring-lead-blue"
          />
          Este cargo requiere asignar un pilar
        </label>

        <FormActions onCancel={onClose} loading={loading} submitLabel={initial ? 'Guardar cambios' : 'Crear rol'} loadingLabel="Guardando..." />
      </form>
    </Modal>
  )
}
