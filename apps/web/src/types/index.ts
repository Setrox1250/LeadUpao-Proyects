// ─── Tipos de dominio para las tablas de Supabase ─────────────────────────

export type EstadoMiembro = 'PENDIENTE' | 'APROBADO_ADMIN' | 'VERIFICADO'
export type EstadoTarea   = 'BACKLOG' | 'EN_PROGRESO' | 'COMPLETADO'

export type NivelPermiso = 'admin' | 'staff' | 'member'

export interface Miembro {
  id:                   string
  discord_id:           string | null
  auth_user_id?:        string | null
  codigo_verificacion?: string | null
  nombre_completo:      string
  correo_institucional: string
  rol_lead:             string
  rol:                  NivelPermiso
  cargo:                string
  pilar?:               string | null
  estado:               EstadoMiembro
  creado_en?:           string
}

// Catálogo de cargos (tabla `roles`): nombre + nivel de permiso asociado
export interface Rol {
  id:               string
  nombre:           string
  nivel_permiso:    NivelPermiso
  requiere_pilar:   boolean
  orden:            number
  discord_role_id?: string | null
}

// Catálogo de pilares (tabla `pilares`)
export interface Pilar {
  id:               string
  nombre:           string
  orden:            number
  discord_role_id?: string | null
}

// Catálogo de redes sociales / enlaces de invitación (tabla `redes_sociales`)
export interface RedSocial {
  id:         string
  plataforma: string
  url:        string
  orden:      number
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

// Entrada del historial de auditoría (tabla logs_auditoria)
export interface LogAuditoria {
  id:           string
  actor_id:     string | null
  actor_nombre: string
  accion:       string
  entidad:      string
  entidad_id:   string | null
  detalles:     Record<string, unknown> | null
  creado_en:    string
}
