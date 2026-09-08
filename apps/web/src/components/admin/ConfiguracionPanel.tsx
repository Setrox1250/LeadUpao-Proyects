'use client'

import { useState } from 'react'
import { sincronizarCatalogosDiscord } from '@/lib/actions/discordSync'
import { useToast } from '@/components/ui/Toast'
import RolesManager from './RolesManager'
import PilaresManager from './PilaresManager'
import RedesSocialesManager from './RedesSocialesManager'
import type { Rol, Pilar, RedSocial } from '@/types'

type Props = { roles: Rol[]; pilares: Pilar[]; redes: RedSocial[] }

export default function ConfiguracionPanel({ roles, pilares, redes }: Props) {
  const { showToast } = useToast()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)

    const { error: err } = await sincronizarCatalogosDiscord()

    if (err) {
      showToast('error', err)
    } else {
      showToast('success', 'Catálogos sincronizados con Discord correctamente.')
    }

    setSyncing(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-gray-400 max-w-md">
          El bot de Discord leerá estos catálogos y creará o enlazará los roles
          correspondientes en el servidor automáticamente.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-lead-navy hover:bg-lead-blue disabled:opacity-60 text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Sincronizando...' : 'Sincronizar Catálogos con Discord'}
        </button>
      </div>

      <RolesManager initialRoles={roles} />
      <PilaresManager initialPilares={pilares} />
      <RedesSocialesManager initialRedes={redes} />
    </div>
  )
}
