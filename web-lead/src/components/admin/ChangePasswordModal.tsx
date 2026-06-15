'use client'

import { useState } from 'react'
import { cambiarMiContrasena } from '@/lib/actions/miembros'
import Modal from '@/components/ui/Modal'
import { FormInput, FormActions, SuccessScreen } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'

type Props = {
  onClose: () => void
}

export default function ChangePasswordModal({ onClose }: Props) {
  const { showToast } = useToast()
  const [actual, setActual]       = useState('')
  const [nueva, setNueva]         = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.set('actual', actual)
    formData.set('nueva', nueva)
    formData.set('confirmar', confirmar)

    const { error: err } = await cambiarMiContrasena(formData)

    if (err) {
      showToast('error', err)
    } else {
      showToast('success', 'Contraseña actualizada correctamente.')
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <Modal onClose={onClose} title="Cambiar contraseña">
        <SuccessScreen onClose={onClose}>
          <p className="text-sm text-gray-600">Tu contraseña se actualizó correctamente.</p>
        </SuccessScreen>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} title="Cambiar contraseña">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Contraseña actual"
          type="password"
          value={actual}
          onChange={e => setActual(e.target.value)}
          required
        />

        <FormInput
          label="Nueva contraseña"
          type="password"
          value={nueva}
          onChange={e => setNueva(e.target.value)}
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres, con letra y número"
        />

        <FormInput
          label="Confirmar nueva contraseña"
          type="password"
          value={confirmar}
          onChange={e => setConfirmar(e.target.value)}
          required
          minLength={8}
        />

        <FormActions onCancel={onClose} loading={loading} submitLabel="Guardar" loadingLabel="Guardando..." />
      </form>
    </Modal>
  )
}
