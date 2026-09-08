// Indicador visual de sincronización con Discord: el bot escribe
// `discord_role_id` vía Supabase Realtime cuando crea/enlaza el rol
// correspondiente en el servidor; aquí solo se refleja ese estado.
export default function DiscordSyncBadge({ discordRoleId }: { discordRoleId?: string | null }) {
  if (!discordRoleId) {
    return <span className="text-xs text-gray-300">Sin enlazar</span>
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
      </svg>
      Discord Sync
    </span>
  )
}
