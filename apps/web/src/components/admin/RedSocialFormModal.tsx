'use client'

import { useState } from 'react'
import { crearRedSocial, actualizarRedSocial } from '@/lib/actions/redesSociales'
import Modal from '@/components/ui/Modal'
import { FormInput, FormActions } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { RedSocial } from '@/types'

type Props = {
  initial?:  RedSocial
  onClose:   () => void
  onSuccess: (red: RedSocial) => void
}

export default function RedSocialFormModal({ initial, onClose, onSuccess }: Props) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    plataforma: initial?.plataforma ?? '',
    url:        initial?.url ?? '',
    orden:      initial?.orden ?? 0,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.plataforma.trim()) { showToast('error', 'El nombre de la plataforma es obligatorio.'); return }
    if (!/^https?:\/\//i.test(form.url.trim())) { showToast('error', 'El enlace debe ser una URL válida (http:// o https://).'); return }

    setLoading(true)

    const formData = new FormData()
    if (initial) formData.set('id', initial.id)
    formData.set('plataforma', form.plataforma.trim())
    formData.set('url', form.url.trim())
    formData.set('orden', String(form.orden))

    const { data, error: err } = initial
      ? await actualizarRedSocial(formData)
      : await crearRedSocial(formData)

    if (err || !data) {
      showToast('error', err ?? 'No se pudo guardar la red social.')
      setLoading(false)
      return
    }

    showToast('success', initial ? 'Red social actualizada correctamente.' : 'Red social agregada correctamente.')
    onSuccess(data)
  }

  return (
    <Modal onClose={onClose} title={initial ? 'Editar enlace' : 'Nuevo enlace'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Plataforma"
          type="text"
          value={form.plataforma}
          onChange={e => setForm(prev => ({ ...prev, plataforma: e.target.value }))}
          required
          placeholder="Ej: Discord, Instagram, Facebook, TikTok, LinkedIn..."
        />

        <FormInput
          label="Enlace"
          type="url"
          value={form.url}
          onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
          required
          placeholder="https://..."
        />

        <FormInput
          label="Orden"
          type="number"
          value={form.orden}
          onChange={e => setForm(prev => ({ ...prev, orden: Number(e.target.value) }))}
          min={0}
        />

        <FormActions onCancel={onClose} loading={loading} submitLabel={initial ? 'Guardar cambios' : 'Agregar enlace'} loadingLabel="Guardando..." />
      </form>
    </Modal>
  )
}
