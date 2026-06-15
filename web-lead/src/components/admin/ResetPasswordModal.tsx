'use client'

import { useState } from 'react'
import { restablecerContrasena } from '@/lib/actions/miembros'
import Modal from '@/components/ui/Modal'
import { FormInput, FormActions, SuccessScreen } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Miembro } from '@/types'

type Props = {
  miembro: Miembro
  onClose: () => void
}

export default function ResetPasswordModal({ miembro, onClose }: Props) {
  const { showToast } = useToast()
  const [contrasena, setContrasena] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.set('miembro_id', miembro.id)
    formData.set('contrasena', contrasena)

    const { error: err } = await restablecerContrasena(formData)

    if (err) {
      showToast('error', err)
    } else {
      showToast('success', 'Contraseña restablecida correctamente.')
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <Modal onClose={onClose} title="Restablecer contraseña" description={miembro.nombre_completo}>
        <SuccessScreen onClose={onClose}>
          <p className="text-sm text-gray-600">
            Contraseña actualizada. Comunícale la nueva contraseña al miembro.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl py-4">
            <span className="text-xl font-mono font-bold tracking-[0.3em] text-lead-navy">
              {contrasena}
            </span>
          </div>
        </SuccessScreen>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} title="Restablecer contraseña" description={miembro.nombre_completo}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Nueva contraseña"
          type="text"
          value={contrasena}
          onChange={e => setContrasena(e.target.value)}
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres, con letra y número"
          className="font-mono"
        />

        <FormActions onCancel={onClose} loading={loading} submitLabel="Restablecer" loadingLabel="Guardando..." />
      </form>
    </Modal>
  )
}
