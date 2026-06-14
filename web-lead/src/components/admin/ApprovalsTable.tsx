'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Miembro } from '@/types'

type Props = {
  initialSolicitudes: Miembro[]
  adminDiscordId:     string
}

export default function ApprovalsTable({ initialSolicitudes, adminDiscordId }: Props) {
  const [solicitudes, setSolicitudes] = useState<Miembro[]>(initialSolicitudes)
  const [updatingId, setUpdatingId]   = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const supabase = createClient()

  const handleApprove = async (memberId: string) => {
    setUpdatingId(memberId)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('miembros')
        .update({
          estado:       'APROBADO_ADMIN',
          aprobado_por: adminDiscordId,
        })
        .eq('id', memberId)

      if (updateError) throw updateError

      // Quitar de la lista reactivamente
      setSolicitudes(prev => prev.filter(s => s.id !== memberId))
    } catch (err) {
      console.error('Error al aprobar miembro:', err)
      setError('No se pudo aprobar al miembro. Inténtalo de nuevo.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {solicitudes.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">
          No hay solicitudes de registro pendientes por evaluar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                {['Nombre Completo', 'Correo Institucional', 'Pilar', 'Fecha Registro', 'Acción'].map(col => (
                  <th key={col} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {solicitudes.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {s.nombre_completo}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {s.correo_institucional}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                      {s.rol_lead}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {s.creado_en ? new Date(s.creado_en).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => handleApprove(s.id)}
                      disabled={updatingId !== null}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm"
                    >
                      {updatingId === s.id ? 'Aprobando...' : 'Aprobar Miembro'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
