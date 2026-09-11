/**
 * Enlace al hilo de la tarea en Discord.
 *
 * Discord necesita el id del servidor en la ruta
 * (`/channels/<guild>/<hilo>`), y la web no lo tenía. Se pasa desde el Server
 * Component leyendo `DISCORD_GUILD_ID`; si no está configurado, el
 * comportamiento es el de antes: se muestra el id del hilo, sin enlace.
 */
export default function DiscordThreadLink({
  hiloId, guildId,
}: {
  hiloId:  string | null
  guildId: string | null
}) {
  if (!hiloId) return null

  const clase = 'shrink-0 text-[11px] text-gray-400 hover:text-lead-blue transition-colors'

  if (!guildId) {
    return <span className={clase} title={`Hilo de Discord ${hiloId}`}>🔗</span>
  }

  return (
    <a
      href={`https://discord.com/channels/${guildId}/${hiloId}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir el hilo en Discord"
      className={clase}
    >
      🔗
    </a>
  )
}
