// ─── Tipos de dominio para las tablas de Supabase ─────────────────────────

export type EstadoMiembro = 'PENDIENTE' | 'APROBADO_ADMIN' | 'VERIFICADO'
export type EstadoTarea   = 'BACKLOG' | 'EN_PROGRESO' | 'COMPLETADO'

export interface Miembro {
  id:                   string
  discord_id:           string | null
  auth_user_id?:        string | null
  codigo_verificacion?: string | null
  nombre_completo:      string
  correo_institucional: string
  rol_lead:             string
  rol?:                 string
  pilar?:               string
  estado:               EstadoMiembro
  aprobado_por:         string | null
  creado_en?:           string
}

export interface Tarea {
  id:               string
  id_discord_hilo:  string | null
  titulo:           string
  descripcion:      string | null
  etiquetas:        string[]
  autor_id:         string | null
  estado:           EstadoTarea
  pilar:            string
  created_at?:      string
}

// Datos que se pasan al gráfico de barras
export interface PilarStat {
  pilar:       string
  completadas: number
}
