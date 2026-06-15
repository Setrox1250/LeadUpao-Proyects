'use client'

import { useState } from 'react'
import { eliminarRol } from '@/lib/actions/roles'
import { useToast } from '@/components/ui/Toast'
import RoleFormModal from './RoleFormModal'
import DiscordSyncBadge from './DiscordSyncBadge'
import type { Rol } from '@/types'

type Props = { initialRoles: Rol[] }

const NIVEL_STYLE: Record<string, { label: string; className: string }> = {
  admin:   { label: 'Administrador', className: 'bg-red-100 text-red-700' },
  staff:   { label: 'Staff',         className: 'bg-blue-100 text-blue-700' },
  member:  { label: 'Miembro común', className: 'bg-gray-100 text-gray-600' },
}

function DeleteRoleButton({ rol, onDeleted }: { rol: Rol; onDeleted: () => void }) {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const formData = new FormData()
    formData.set('id', rol.id)
    const { error: err } = await eliminarRol(formData)

    if (err) {
      showToast('error', err)
      setDeleting(false)
      setConfirming(false)
      return
    }

    showToast('success', 'Rol eliminado correctamente.')
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

export default function RolesManager({ initialRoles }: Props) {
  const [roles, setRoles]         = useState<Rol[]>(initialRoles)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Rol | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">Roles / Cargos</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-lead-navy hover:bg-lead-blue text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar rol
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {['Cargo', 'Nivel de permiso', 'Requiere pilar', 'Orden', 'Discord', 'Acciones'].map(col => (
                <th key={col} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {roles.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8">No hay roles configurados.</td>
              </tr>
            ) : (
              roles.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.nombre}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${NIVEL_STYLE[r.nivel_permiso]?.className ?? 'bg-gray-100 text-gray-600'}`}>
                      {NIVEL_STYLE[r.nivel_permiso]?.label ?? r.nivel_permiso}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.requiere_pilar ? 'Sí' : 'No'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.orden}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DiscordSyncBadge discordRoleId={r.discord_role_id} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap space-x-3">
                    <button onClick={() => setEditTarget(r)} className="text-xs font-medium text-lead-blue hover:text-lead-navy transition-colors">
                      Editar
                    </button>
                    <DeleteRoleButton rol={r} onDeleted={() => setRoles(prev => prev.filter(x => x.id !== r.id))} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <RoleFormModal
          onClose={() => setShowModal(false)}
          onSuccess={newRol => {
            setRoles(prev => [...prev, newRol].sort((a, b) => a.orden - b.orden))
            setShowModal(false)
          }}
        />
      )}

      {editTarget && (
        <RoleFormModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={updated => {
            setRoles(prev => prev.map(x => x.id === updated.id ? updated : x).sort((a, b) => a.orden - b.orden))
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}
