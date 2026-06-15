'use client'

import { useState, useEffect }       from 'react'
import { PILAR_COLORS }        from '@/lib/constants'
import { eliminarMiembro }     from '@/lib/actions/miembros'
import { useToast }            from '@/components/ui/Toast'
import type { Miembro, Rol, Pilar }   from '@/types'
import AddMemberModal      from './AddMemberModal'
import EditMemberModal     from './EditMemberModal'
import ResetPasswordModal  from './ResetPasswordModal'
import ApproveMemberModal  from './ApproveMemberModal'

type Props = { initialMembers: Miembro[]; roles: Rol[]; pilares: Pilar[] }

const ESTADO_STYLE: Record<string, string> = {
  VERIFICADO:     'bg-green-100 text-green-700',
  APROBADO_ADMIN: 'bg-blue-100 text-blue-700',
  PENDIENTE:      'bg-amber-100 text-amber-700',
}

const PAGE_SIZE = 20

// Genera y descarga un CSV (con BOM para que Excel detecte UTF-8) a partir
// de los miembros actualmente filtrados.
function exportarCSV(miembros: Miembro[]) {
  const headers = ['Nombre Completo', 'Correo', 'Cargo', 'Pilar', 'Discord ID', 'Código', 'Estado']
  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`

  const rows = miembros.map(m => [
    m.nombre_completo,
    m.correo_institucional,
    m.cargo,
    m.pilar ?? '',
    m.discord_id ?? '',
    m.codigo_verificacion ?? '',
    m.estado,
  ].map(v => escapeCell(String(v ?? ''))).join(','))

  const BOM = String.fromCharCode(0xFEFF)
  const csv = BOM + [headers.map(escapeCell).join(','), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `miembros-lead-upao-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()

  URL.revokeObjectURL(url)
}

// Botón "Eliminar" con confirmación inline, igual al patrón usado en RolesManager.
function DeleteMemberButton({ miembro, onDeleted }: { miembro: Miembro; onDeleted: () => void }) {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const formData = new FormData()
    formData.set('miembro_id', miembro.id)
    const { error: err } = await eliminarMiembro(formData)

    if (err) {
      showToast('error', err)
      setDeleting(false)
      setConfirming(false)
      return
    }

    showToast('success', 'Miembro eliminado correctamente.')
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

export default function MembersTable({ initialMembers, roles, pilares }: Props) {
  const [members, setMembers]   = useState<Miembro[]>(initialMembers)
  const [search, setSearch]     = useState('')
  const [filterPilar, setFilter] = useState('all')
  const [page, setPage]         = useState(1)
  const [showModal, setModal]   = useState(false)
  const [editTarget, setEditTarget] = useState<Miembro | null>(null)
  const [resetTarget, setResetTarget] = useState<Miembro | null>(null)
  const [approveTarget, setApproveTarget] = useState<Miembro | null>(null)

  // Filtrado local (sin roundtrip al servidor)
  const filtered = members.filter(m => {
    const matchSearch = [m.nombre_completo, m.correo_institucional, m.discord_id, m.codigo_verificacion]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchPilar = filterPilar === 'all' || m.pilar === filterPilar
    return matchSearch && matchPilar
  })

  // Volver a la primera página cuando cambian los filtros
  useEffect(() => { setPage(1) }, [search, filterPilar])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o Discord ID..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue"
          />
        </div>

        {/* Filtro por pilar */}
        <select
          value={filterPilar}
          onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lead-blue"
        >
          <option value="all">Todos los pilares</option>
          {pilares.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
        </select>

        {/* Botón exportar CSV */}
        <button
          onClick={() => exportarCSV(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 border border-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Exportar CSV
        </button>

        {/* Botón agregar */}
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 bg-lead-navy hover:bg-lead-blue text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar miembro
        </button>
      </div>

      {/* Contador */}
      <p className="text-xs text-gray-400 mb-3">
        Mostrando {filtered.length} de {members.length} miembros
      </p>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {['Nombre Completo', 'Correo', 'Cargo', 'Pilar', 'Discord ID', 'Código', 'Estado', 'Acciones'].map(col => (
                <th key={col} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-10">
                  No se encontraron miembros con los filtros actuales.
                </td>
              </tr>
            ) : (
              paginated.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{m.nombre_completo}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.correo_institucional}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PILAR_COLORS[m.cargo] ?? 'bg-blue-50 text-blue-700'}`}>
                      {m.cargo}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.pilar ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PILAR_COLORS[m.pilar] ?? 'bg-blue-50 text-blue-700'}`}>
                        {m.pilar}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                    {m.discord_id ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs font-semibold tracking-widest whitespace-nowrap">
                    {m.codigo_verificacion ?? <span className="text-gray-300 font-normal tracking-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ESTADO_STYLE[m.estado]}`}>
                      {m.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap space-x-3">
                    {m.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => setApproveTarget(m)}
                        className="text-xs font-medium text-green-600 hover:text-green-800 transition-colors"
                      >
                        Aprobar
                      </button>
                    )}
                    <button
                      onClick={() => setEditTarget(m)}
                      className="text-xs font-medium text-lead-blue hover:text-lead-navy transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setResetTarget(m)}
                      className="text-xs font-medium text-lead-blue hover:text-lead-navy transition-colors"
                    >
                      Restablecer contraseña
                    </button>
                    <DeleteMemberButton
                      miembro={m}
                      onDeleted={() => setMembers(prev => prev.filter(x => x.id !== m.id))}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs font-medium border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-xs font-medium border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal para agregar miembro */}
      {showModal && (
        <AddMemberModal
          roles={roles}
          pilares={pilares}
          onClose={() => setModal(false)}
          onSuccess={newMember => setMembers(prev => [newMember, ...prev])}
        />
      )}

      {/* Modal para editar miembro */}
      {editTarget && (
        <EditMemberModal
          miembro={editTarget}
          roles={roles}
          pilares={pilares}
          onClose={() => setEditTarget(null)}
          onSuccess={updated => {
            setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
            setEditTarget(null)
          }}
        />
      )}

      {/* Modal para restablecer contraseña */}
      {resetTarget && (
        <ResetPasswordModal
          miembro={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}

      {/* Modal para aprobar miembro pendiente */}
      {approveTarget && (
        <ApproveMemberModal
          miembro={approveTarget}
          roles={roles}
          pilares={pilares}
          onClose={() => setApproveTarget(null)}
          onApproved={(cargo, pilar) => {
            setMembers(prev => prev.map(m => m.id === approveTarget.id
              ? { ...m, cargo, pilar: pilar || null, estado: 'APROBADO_ADMIN', rol_lead: pilar || cargo }
              : m
            ))
            setApproveTarget(null)
          }}
        />
      )}
    </>
  )
}
