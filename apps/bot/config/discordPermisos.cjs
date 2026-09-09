/**
 * Presets de permisos de Discord por nivel de permiso.
 *
 * ─── POR QUÉ ESTO VIVE EN CÓDIGO Y NO EN LA BASE DE DATOS ───────────────────
 *
 * El panel web escribe en la tabla `roles`. Si el nivel de permiso se tradujera
 * a un bitfield editable desde ahí, comprometer la web sería comprometer el
 * servidor de Discord entero: bastaría con marcar Administrator en un rol
 * propio. Con los presets en el repositorio, la única forma de ampliar
 * permisos es un commit revisable, y `roles.nivel_permiso` solo puede elegir
 * entre tres conjuntos cerrados.
 *
 * Se usan NOMBRES de permiso (no bits) para que el archivo sea legible en una
 * revisión de código. El bot los resuelve contra PermissionFlagsBits.
 *
 * Ninguno incluye Administrator: omite todos los permisos por canal —incluida
 * la privacidad por área de docs/discord-tareas.md— y una cuenta comprometida
 * podría borrar el servidor. La Directiva recibe el conjunto explícito de
 * abajo, que en la práctica permite lo mismo pero deja rastro de qué puede
 * hacer cada rol.
 */

// Base de participación: lo que puede cualquier miembro verificado.
const MEMBER = [
  'ViewChannel',
  'ReadMessageHistory',
  'SendMessages',
  'SendMessagesInThreads',
  'CreatePublicThreads',
  'AddReactions',
  'AttachFiles',
  'EmbedLinks',
  'UseExternalEmojis',
  'Connect',
  'Speak',
];

// Moderación de contenido: Chief of Staff, Treasure / Fundraising, Leader.
const STAFF = [
  ...MEMBER,
  'CreatePrivateThreads',
  'ManageMessages',
  'ManageThreads',
  'MuteMembers',
  'MoveMembers',
  'ModerateMembers',
];

// Directiva: President y Vice-President.
const ADMIN = [
  ...STAFF,
  'ManageGuild',
  'ManageChannels',
  'ManageRoles',
  'KickMembers',
  'BanMembers',
  'ViewAuditLog',
];

module.exports = {
  PRESETS: { member: MEMBER, staff: STAFF, admin: ADMIN },

  /**
   * Roles de pilar: dan acceso a la categoría de su área mediante overwrites,
   * no mediante permisos de servidor. Por eso van vacíos a propósito.
   */
  PRESET_PILAR: [],
};
