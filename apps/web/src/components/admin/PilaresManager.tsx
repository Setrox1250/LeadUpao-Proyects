'use client'

import { useState } from 'react'
import { eliminarPilar } from '@/lib/actions/pilares'
import { useToast } from '@/components/ui/Toast'
import PilarFormModal from './PilarFormModal'
import DiscordSyncBadge from './DiscordSyncBadge'
import type { Pilar } from '@/types'

type Props = { initialPilares: Pilar[] }

function DeletePilarButton({ pilar, onDeleted }: { pilar: Pilar; onDeleted: () => void }) {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const formData = new FormData()
    formData.set('id', pilar.id)
    const { error: err } = await eliminarPilar(formData)

    if (err) {
      showToast('error', err)
      setDeleting(false)
      setConfirming(false)
      return
    }

    showToast('success', 'Pilar eliminado correctamente.')
    onDeleted()
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-[10px] text-red-600 font-medium mr-1">¿Eliminar?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-md font-medium transition-colors disabled:opacity-60"
        >
          {deleting ? '...' : 'Sí'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-[10px] border border-gray-300 text-gray-600 hover:bg-gray-50 px-2 py-0.5 rounded-md font-medium transition-colors disabled:opacity-60"
        >
          No
        </button>
      </span>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
      Eliminar
    </button>
  )
}

export default function PilaresManager({ initialPilares }: Props) {
  const [pilares, setPilares]     = useState<Pilar[]>(initialPilares)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Pilar | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">Pilares</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-lead-navy hover:bg-lead-blue text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar pilar
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {['Pilar', 'Orden', 'Discord', 'Acciones'].map(col => (
                <th key={col} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {pilares.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-8">No hay pilares configurados.</td>
              </tr>
            ) : (
              pilares.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.orden}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DiscordSyncBadge discordRoleId={p.discord_role_id} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap space-x-3">
                    <button onClick={() => setEditTarget(p)} className="text-xs font-medium text-lead-blue hover:text-lead-navy transition-colors">
                      Editar
                    </button>
                    <DeletePilarButton pilar={p} onDeleted={() => setPilares(prev => prev.filter(x => x.id !== p.id))} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <PilarFormModal
          onClose={() => setShowModal(false)}
          onSuccess={newPilar => {
            setPilares(prev => [...prev, newPilar].sort((a, b) => a.orden - b.orden))
            setShowModal(false)
          }}
        />
      )}

      {editTarget && (
        <PilarFormModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={updated => {
            setPilares(prev => prev.map(x => x.id === updated.id ? updated : x).sort((a, b) => a.orden - b.orden))
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}
