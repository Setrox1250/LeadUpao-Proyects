import type { LogAuditoria } from '@/types'

type Props = { logs: LogAuditoria[] }

// Etiqueta legible y color de badge por tipo de acción registrada.
const ACCION_STYLE: Record<string, { label: string; className: string }> = {
  CREAR_MIEMBRO:           { label: 'Miembro creado',        className: 'bg-blue-100 text-blue-700' },
  APROBAR_MIEMBRO:         { label: 'Miembro aprobado',      className: 'bg-green-100 text-green-700' },
  RESET_PASSWORD:          { label: 'Contraseña restablecida', className: 'bg-amber-100 text-amber-700' },
  CREAR_TAREA:             { label: 'Tarea creada',          className: 'bg-purple-100 text-purple-700' },
  ACTUALIZAR_ESTADO_TAREA: { label: 'Estado de tarea',       className: 'bg-cyan-100 text-cyan-700' },
  ELIMINAR_TAREA:          { label: 'Tarea eliminada',       className: 'bg-red-100 text-red-700' },
  CREAR_ROL:               { label: 'Rol creado',            className: 'bg-indigo-100 text-indigo-700' },
  ACTUALIZAR_ROL:          { label: 'Rol actualizado',       className: 'bg-indigo-100 text-indigo-700' },
  ELIMINAR_ROL:            { label: 'Rol eliminado',         className: 'bg-red-100 text-red-700' },
  CREAR_PILAR:             { label: 'Pilar creado',          className: 'bg-teal-100 text-teal-700' },
  ACTUALIZAR_PILAR:        { label: 'Pilar actualizado',     className: 'bg-teal-100 text-teal-700' },
  ELIMINAR_PILAR:          { label: 'Pilar eliminado',       className: 'bg-red-100 text-red-700' },
  SYNC_DISCORD:            { label: 'Sincronización con Discord', className: 'bg-violet-100 text-violet-700' },
}

const ENTIDAD_LABEL: Record<string, string> = {
  miembro:  'Miembro',
  tarea:    'Tarea',
  rol:      'Rol',
  pilar:    'Pilar',
  catalogo: 'Catálogo',
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function AuditLogTable({ logs }: Props) {
  if (logs.length === 0) {
    return <p className="text-center text-gray-400 text-sm py-10">Aún no hay actividad registrada.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-left">
            {['Fecha', 'Usuario', 'Acción', 'Entidad', 'Detalles'].map(col => (
              <th key={col} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {logs.map(log => {
            const accionStyle = ACCION_STYLE[log.accion] ?? { label: log.accion, className: 'bg-gray-100 text-gray-600' }
            const tieneDetalles = log.detalles && Object.keys(log.detalles).length > 0

            return (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors align-top">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{formatFecha(log.creado_en)}</td>
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{log.actor_nombre}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accionStyle.className}`}>
                    {accionStyle.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {ENTIDAD_LABEL[log.entidad] ?? log.entidad}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {tieneDetalles ? (
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-lead-blue hover:underline">
                        Ver detalles
                      </summary>
                      <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2 text-[11px] text-gray-600 whitespace-pre-wrap break-all max-w-md">
                        {JSON.stringify(log.detalles, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
