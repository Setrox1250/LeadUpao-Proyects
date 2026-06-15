'use client'

import { useState } from 'react'
import { eliminarRedSocial } from '@/lib/actions/redesSociales'
import { useToast } from '@/components/ui/Toast'
import RedSocialFormModal from './RedSocialFormModal'
import type { RedSocial } from '@/types'

type Props = { initialRedes: RedSocial[] }

function DeleteRedSocialButton({ red, onDeleted }: { red: RedSocial; onDeleted: () => void }) {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const formData = new FormData()
    formData.set('id', red.id)
    const { error: err } = await eliminarRedSocial(formData)

    if (err) {
      showToast('error', err)
      setDeleting(false)
      setConfirming(false)
      return
    }

    showToast('success', 'Red social eliminada correctamente.')
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

export default function RedesSocialesManager({ initialRedes }: Props) {
  const [redes, setRedes]         = useState<RedSocial[]>(initialRedes)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<RedSocial | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Redes Sociales y Discord</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            El enlace de Discord se mostrará a los nuevos miembros al registrarse, para que se unan al servidor sin invitación personal.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-lead-navy hover:bg-lead-blue text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar enlace
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {['Plataforma', 'Enlace', 'Orden', 'Acciones'].map(col => (
                <th key={col} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {redes.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-8">No hay redes sociales configuradas.</td>
              </tr>
            ) : (
              redes.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.plataforma}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap max-w-xs truncate">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-lead-blue hover:underline">
                      {r.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.orden}</td>
                  <td className="px-4 py-3 whitespace-nowrap space-x-3">
                    <button onClick={() => setEditTarget(r)} className="text-xs font-medium text-lead-blue hover:text-lead-navy transition-colors">
                      Editar
                    </button>
                    <DeleteRedSocialButton red={r} onDeleted={() => setRedes(prev => prev.filter(x => x.id !== r.id))} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <RedSocialFormModal
          onClose={() => setShowModal(false)}
          onSuccess={newRed => {
            setRedes(prev => [...prev, newRed].sort((a, b) => a.orden - b.orden))
            setShowModal(false)
          }}
        />
      )}

      {editTarget && (
        <RedSocialFormModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={updated => {
            setRedes(prev => prev.map(x => x.id === updated.id ? updated : x).sort((a, b) => a.orden - b.orden))
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}
