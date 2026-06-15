'use client'

import { useState } from 'react'
import { aprobarMiembro } from '@/lib/actions/miembros'
import Modal from '@/components/ui/Modal'
import { FormSelect, FormActions } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Miembro, Rol, Pilar } from '@/types'

type Props = {
  miembro:   Miembro
  roles:     Rol[]
  pilares:   Pilar[]
  onClose:   () => void
  onApproved: (cargo: string, pilar: string) => void
}

export default function ApproveMemberModal({ miembro, roles, pilares, onClose, onApproved }: Props) {
  const { showToast } = useToast()
  const [cargo, setCargo] = useState(miembro.cargo ?? roles[0]?.nombre ?? '')
  const [pilar, setPilar] = useState(miembro.pilar ?? pilares[0]?.nombre ?? '')
  const [loading, setLoading] = useState(false)

  const cargoActual   = roles.find(r => r.nombre === cargo)
  const requierePilar = cargoActual?.requiere_pilar ?? false

  const handleCargoChange = (value: string) => {
    setCargo(value)
    const nuevoCargo = roles.find(r => r.nombre === value)
    if (!nuevoCargo?.requiere_pilar) {
      setPilar('')
    } else if (!pilar) {
      setPilar(pilares[0]?.nombre ?? '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.set('miembro_id', miembro.id)
    formData.set('cargo', cargo)
    formData.set('pilar', pilar)

    const { error: err } = await aprobarMiembro(formData)

    if (err) {
      showToast('error', err)
      setLoading(false)
      return
    }

    showToast('success', 'Miembro aprobado correctamente.')
    onApproved(cargo, pilar)
  }

  return (
    <Modal onClose={onClose} title="Aprobar miembro" description={miembro.nombre_completo}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSelect label="Cargo" value={cargo} onChange={e => handleCargoChange(e.target.value)} required>
          {roles.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
        </FormSelect>

        {requierePilar && (
          <FormSelect label="Pilar Oficial" value={pilar} onChange={e => setPilar(e.target.value)} required>
            {pilares.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
          </FormSelect>
        )}

        <FormActions onCancel={onClose} loading={loading} submitLabel="Aprobar" loadingLabel="Guardando..." />
      </form>
    </Modal>
  )
}
