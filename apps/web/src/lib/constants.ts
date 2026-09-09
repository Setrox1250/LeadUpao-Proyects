// Etiquetas uniformes para tareas (deben coincidir con los tags del foro de Discord)
export const ETIQUETAS_TAREA = [
  'Urgente',
  'Idea / Propuesta',
  'Documentación',
  'Operaciones',
  'Evento / Proyecto',
] as const

export type EtiquetaTarea = (typeof ETIQUETAS_TAREA)[number]

// Colores Tailwind por etiqueta para badges visuales
export const ETIQUETA_COLORS: Record<EtiquetaTarea, string> = {
  'Urgente':           'bg-red-100 text-red-700 border-red-200',
  'Idea / Propuesta':  'bg-purple-100 text-purple-700 border-purple-200',
  'Documentación':     'bg-blue-100 text-blue-700 border-blue-200',
  'Operaciones':       'bg-orange-100 text-orange-700 border-orange-200',
  'Evento / Proyecto': 'bg-green-100 text-green-700 border-green-200',
}

// Colores Tailwind por pilar / cargo de directiva para los badges de "Pilar de Trabajo"
// Colores por área y por cargo de directiva, para los badges.
// Los nombres siguen el organigrama oficial (migración 0007).
export const PILAR_COLORS: Record<string, string> = {
  'Área de Innovación Tecnológica':             'bg-blue-50 text-blue-700',
  'Área Académica':                             'bg-violet-50 text-violet-700',
  'Área de Liderazgo y Desarrollo Profesional': 'bg-amber-50 text-amber-700',
  'Área de Impacto Comunitario':                'bg-rose-50 text-rose-700',
  'Área de Excelencia Femenina':                'bg-pink-50 text-pink-700',
  'Área de Cooperación y Alianzas':             'bg-emerald-50 text-emerald-700',
  'Presidente':                                 'bg-lead-navy/10 text-lead-navy',
  'Vicepresidente':                             'bg-lead-navy/10 text-lead-navy',
  'TI':                                         'bg-blue-50 text-blue-700',
  'Chief of Staff':                             'bg-gray-100 text-gray-700',
  'Treasure / Fundraising':                     'bg-gray-100 text-gray-700',
  'Marketing':                                  'bg-gray-100 text-gray-700',
}

// Etiqueta para las tareas que no pertenecen a ningún área.
export const SIN_AREA = 'General'

// Columnas del tablero Kanban con su estilo de Tailwind
export const TASK_COLUMNS = [
  { key: 'BACKLOG'     as const, label: 'Backlog',      headerColor: 'bg-gray-200 text-gray-700',   bodyColor: 'bg-gray-50 border-gray-200'   },
  { key: 'EN_PROGRESO' as const, label: 'En Progreso',  headerColor: 'bg-blue-200 text-blue-800',   bodyColor: 'bg-blue-50 border-blue-200'   },
  { key: 'COMPLETADO'  as const, label: 'Completado',   headerColor: 'bg-green-200 text-green-800', bodyColor: 'bg-green-50 border-green-200' },
]
