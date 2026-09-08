'use client'

import { useState } from 'react'
import { crearMiembro } from '@/lib/actions/miembros'
import Modal from '@/components/ui/Modal'
import { FormInput, FormSelect, FormActions, SuccessScreen } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Miembro, Rol, Pilar } from '@/types'

type Props = {
  roles:     Rol[]
  pilares:   Pilar[]
  onClose:   () => void
  onSuccess: (newMember: Miembro) => void
}

export default function AddMemberModal({ roles, pilares, onClose, onSuccess }: Props) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    nombre_completo:      '',
    correo_institucional: '',
    cargo:                roles.find(r => r.nombre === 'Member')?.nombre ?? roles[0]?.nombre ?? '',
    pilar:                pilares[0]?.nombre ?? '',
    contrasena:           '',
  })
  const [loading, setLoading] = useState(false)
  const [codigoCreado, setCodigoCreado] = useState<string | null>(null)
  const [contrasenaCreada, setContrasenaCreada] = useState<string | null>(null)

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
      formData.set('nombre_completo', form.nombre_completo.trim())
      formData.set('correo_institucional', form.correo_institucional.trim().toLowerCase())
      formData.set('cargo', form.cargo)
      formData.set('pilar', form.pilar)
      formData.set('contrasena', form.contrasena)

      const { data, error: err } = await crearMiembro(formData)

      if (err || !data) {
        throw new Error(err ?? 'Error al crear el miembro.')
      }

      const mappedMember: Miembro = {
        ...(data as any),
        rol_lead: data.pilar || data.cargo,
      }

      onSuccess(mappedMember)
      showToast('success', 'Miembro agregado correctamente.')
      setCodigoCreado(data.codigo_verificacion)
      setContrasenaCreada(form.contrasena)
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Error al crear el miembro.')
    } finally {
      setLoading(false)
    }
  }

  if (codigoCreado) {
    return (
      <Modal onClose={onClose} title="Agregar Miembro">
        <SuccessScreen onClose={onClose}>
          <p className="text-sm text-gray-600">
            Miembro agregado. Compártele este código de verificación para que vincule su cuenta
            de Discord con el comando <span className="font-mono font-semibold">/verificar</span> o
            para que inicie sesión en la web con su código y contraseña.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Código de verificación</p>
            <span className="text-2xl font-mono font-bold tracking-[0.3em] text-lead-navy">
              {codigoCreado}
            </span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Contraseña</p>
            <span className="text-2xl font-mono font-bold tracking-[0.3em] text-lead-navy">
              {contrasenaCreada}
            </span>
          </div>
        </SuccessScreen>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} title="Agregar Miembro" size="md">
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

        <FormInput
          label="Contraseña inicial"
          type="text"
          name="contrasena"
          value={form.contrasena}
          onChange={handleChange}
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres, con letra y número"
          className="font-mono"
          hint="El miembro podrá cambiarla luego desde su panel."
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

        <FormActions onCancel={onClose} loading={loading} submitLabel="Agregar miembro" loadingLabel="Guardando..." />
      </form>
    </Modal>
  )
}
