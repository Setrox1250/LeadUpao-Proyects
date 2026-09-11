import type { Urgencia } from '@/lib/fechas'

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

// Etiqueta para las tareas que no pertenecen a ningún área. Son las del foro
// general de Discord (`pilar is null`), visibles para todo el mundo.
export const SIN_AREA = 'General'

// Valores centinela del filtro de área del tablero. No son nombres de pilar:
// empiezan con '__' justamente para no poder colisionar con uno.
export const AREA_TODAS   = '__todas__'
export const AREA_GENERAL = '__general__'

// Columnas del tablero Kanban con su estilo de Tailwind
export const TASK_COLUMNS = [
  { key: 'BACKLOG'     as const, label: 'Backlog',      headerColor: 'bg-gray-200 text-gray-700',   bodyColor: 'bg-gray-50 border-gray-200'   },
  { key: 'EN_PROGRESO' as const, label: 'En Progreso',  headerColor: 'bg-blue-200 text-blue-800',   bodyColor: 'bg-blue-50 border-blue-200'   },
  { key: 'COMPLETADO'  as const, label: 'Completado',   headerColor: 'bg-green-200 text-green-800', bodyColor: 'bg-green-50 border-green-200' },
]

// Estilo del badge de vencimiento según cuánto falta. Vencida y «hoy» gritan;
// próxima avisa; futura no compite con el resto de la tarjeta.
export const VENCIMIENTO_COLORS: Record<Urgencia, string> = {
  vencida: 'bg-red-100 text-red-700 border-red-200',
  hoy:     'bg-orange-100 text-orange-700 border-orange-200',
  proxima: 'bg-amber-50 text-amber-700 border-amber-200',
  futura:  'bg-gray-100 text-gray-500 border-gray-200',
}

// Criterios de orden del tablero y de la lista.
export const ORDENES = [
  { key: 'vencimiento' as const, label: 'Vencimiento' },
  { key: 'recientes'   as const, label: 'Más recientes' },
  { key: 'titulo'      as const, label: 'Título (A-Z)' },
]
export type OrdenTareas = (typeof ORDENES)[number]['key']

// Filtro rápido por vencimiento.
export const FILTROS_VENCIMIENTO = [
  { key: 'TODAS'     as const, label: 'Cualquier fecha' },
  { key: 'VENCIDAS'  as const, label: 'Vencidas sin entregar' },
  { key: 'SEMANA'    as const, label: 'Próximos 7 días' },
  { key: 'SIN_FECHA' as const, label: 'Sin fecha' },
]
export type FiltroVencimiento = (typeof FILTROS_VENCIMIENTO)[number]['key']
