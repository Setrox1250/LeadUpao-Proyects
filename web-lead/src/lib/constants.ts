// Roles oficiales de LEAD UPAO
export const ROLES = [
  'Miembro',
  'Leader',
  'Chief of Staff',
  'Treasure / Fundraising',
  'Vice-President',
  'President',
] as const

export type Rol = (typeof ROLES)[number]

// Pilares oficiales de LEAD UPAO
export const PILARES = [
  'Innovación Tecnológica',
  'Desarrollo del Capítulo',
  'Excelencia Académica',
  'Liderazgo',
  'Desarrollo Profesional',
  'Impacto Comunitario',
  'Excelencia Femenina',
  'LEAD Academia',
] as const

export type Pilar = (typeof PILARES)[number]

// Roles y pilares administrativos (para permisos de directiva/supervisión)
export const ROLES_ADMIN = ['President', 'Vice-President'] as const
export const PILAR_ADMIN_EXCEPTION = 'Innovación Tecnológica'

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

// Columnas del tablero Kanban con su estilo de Tailwind
export const TASK_COLUMNS = [
  { key: 'BACKLOG'     as const, label: 'Backlog',      headerColor: 'bg-gray-200 text-gray-700',   bodyColor: 'bg-gray-50 border-gray-200'   },
  { key: 'EN_PROGRESO' as const, label: 'En Progreso',  headerColor: 'bg-blue-200 text-blue-800',   bodyColor: 'bg-blue-50 border-blue-200'   },
  { key: 'COMPLETADO'  as const, label: 'Completado',   headerColor: 'bg-green-200 text-green-800', bodyColor: 'bg-green-50 border-green-200' },
]
