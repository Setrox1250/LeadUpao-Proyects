'use client'

import { useState }       from 'react'
import { PILARES }        from '@/lib/constants'
import type { Miembro }   from '@/types'
import AddMemberModal     from './AddMemberModal'

type Props = { initialMembers: Miembro[] }

const ESTADO_STYLE: Record<string, string> = {
  VERIFICADO:     'bg-green-100 text-green-700',
  APROBADO_ADMIN: 'bg-blue-100 text-blue-700',
  PENDIENTE:      'bg-amber-100 text-amber-700',
}

export default function MembersTable({ initialMembers }: Props) {
  const [members, setMembers]   = useState<Miembro[]>(initialMembers)
  const [search, setSearch]     = useState('')
  const [filterPilar, setFilter] = useState('all')
  const [showModal, setModal]   = useState(false)

  // Filtrado local (sin roundtrip al servidor)
  const filtered = members.filter(m => {
    const matchSearch = [m.nombre_completo, m.correo_institucional, m.discord_id]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchPilar = filterPilar === 'all' || m.rol_lead === filterPilar
    return matchSearch && matchPilar
  })

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
          {PILARES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

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
              {['Nombre Completo', 'Correo', 'Pilar de Trabajo', 'Discord ID', 'Aprobado Por', 'Estado'].map(col => (
                <th key={col} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-10">
                  No se encontraron miembros con los filtros actuales.
                </td>
              </tr>
            ) : (
              filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{m.nombre_completo}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.correo_institucional}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {m.rol_lead}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                    {m.discord_id}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                    {m.aprobado_por ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ESTADO_STYLE[m.estado]}`}>
                      {m.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para agregar miembro */}
      {showModal && (
        <AddMemberModal
          onClose={() => setModal(false)}
          onSuccess={newMember => setMembers(prev => [newMember, ...prev])}
        />
      )}
    </>
  )
}
