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
// de permiso): intencionalmente restringido a President/Vice-President por
// `cargo` (no por `rol`), para que el catálogo de permisos no pueda
// auto-modificarse desde un cargo de nivel "admin" creado a futuro.
export function isFounder(perfil: PerfilRol): boolean {
  return perfil.cargo === 'President' || perfil.cargo === 'Vice-President'
}

// Etiqueta a mostrar como "Cargo / Pilar" del miembro: el pilar si tiene uno
// asignado, o su cargo en caso contrario (ej. President, Vice-President).
export function getCargoLabel(perfil: PerfilRol): string {
  return perfil.pilar || perfil.cargo || ''
}
