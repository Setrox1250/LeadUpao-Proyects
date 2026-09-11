// ─── RBAC centralizado ──────────────────────────────────────────────────
// Punto único de verdad para derivar los permisos de un miembro a partir de
// sus 3 columnas: `rol` (nivel de permiso del sistema: admin/staff/member,
// derivado automáticamente por la BD a partir del `cargo`), `cargo`
// (posición: President, Leader, Member, etc.) y `pilar` (solo si el cargo
// lo requiere). Usado por páginas, layouts y Server Actions para evitar que
// las reglas de autorización queden duplicadas y se desincronicen entre sí.

type PerfilRol = {
  rol?:   string | null
  cargo?: string | null
  pilar?: string | null
}

// Administrador del panel: gestiona miembros, auditoría y supervisa el
// Kanban de todos los pilares.
export function isAdmin(perfil: PerfilRol): boolean {
  return perfil.rol === 'admin'
}

// Staff: además de admins, incluye cargos de nivel intermedio (ej. Leader),
// que pueden crear/gestionar tareas dentro de su propio pilar.
export function isStaff(perfil: PerfilRol): boolean {
  return perfil.rol === 'admin' || perfil.rol === 'staff'
}

// Acceso al panel de Configuración (catálogos de roles/pilares y sus niveles
// de permiso): intencionalmente restringido por `cargo` y no por `rol`, para
// que el catálogo de permisos no pueda auto-modificarse desde un cargo de
// nivel "admin" creado a futuro.
//
// TI queda fuera A PROPÓSITO aunque tenga `rol = 'admin'`: ese es justamente
// el caso que esta comprobación existe para excluir.
//
// Los nombres son los del organigrama oficial. La migración 0007 los pasó al
// español y esta comparación se quedó en inglés, así que devolvía `false`
// para TODO el mundo: en producción los cargos son 'Presidente',
// 'Vicepresidente', 'TI' y 'Miembro'. Nadie podía abrir Configuración,
// sincronizar con Discord ni editar cargos, áreas y redes sociales.
//
// Se comparan cadenas porque `roles.nivel_permiso` no distingue Presidencia
// de TI. Si algún día hace falta, el arreglo de fondo es una columna propia
// en `roles`, no añadir más nombres aquí.
const CARGOS_FUNDADORES: readonly string[] = ['Presidente', 'Vicepresidente']

export function isFounder(perfil: PerfilRol): boolean {
  return perfil.cargo != null && CARGOS_FUNDADORES.includes(perfil.cargo)
}

// Etiqueta a mostrar como "Cargo / Pilar" del miembro: el pilar si tiene uno
// asignado, o su cargo en caso contrario (ej. President, Vice-President).
export function getCargoLabel(perfil: PerfilRol): string {
  return perfil.pilar || perfil.cargo || ''
}
