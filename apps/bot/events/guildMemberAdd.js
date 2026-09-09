const { Events, AttachmentBuilder } = require('discord.js');
const { generarBanner } = require('../services/welcomeBanner');

const MENSAJE = (miembro) =>
    `¡Bienvenido(a) ${miembro} a **LEAD UPAO**! 🎉 Pasa por el canal de verificación ` +
    'para darte de alta de forma oficial.';

/** Resuelve el canal de bienvenidas. El ID configurado manda; si no, se busca por nombre. */
function resolverCanal(guild) {
    const configurado = process.env.WELCOME_CHANNEL_ID;
    if (configurado) {
        const canal = guild.channels.cache.get(configurado);
        if (canal) return canal;
        console.error(`[guildMemberAdd] WELCOME_CHANNEL_ID=${configurado} no existe en el servidor.`);
    }

    return guild.systemChannel ?? guild.channels.cache.find((ch) =>
        ['bienvenidas', 'welcome', 'bienvenida'].includes(ch.name?.toLowerCase())) ?? null;
}

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        const canal = resolverCanal(member.guild);
        if (!canal) {
            console.error(
                '[guildMemberAdd] Sin canal de bienvenidas: define WELCOME_CHANNEL_ID ' +
                `o crea un canal llamado "bienvenidas". Nuevo miembro: ${member.user.tag}`);
            return;
        }

        // Permisos comprobados antes de intentar nada: así el error dice qué
        // falta en vez de llegar como un rechazo genérico de la API.
        const permisos = canal.permissionsFor(member.guild.members.me);
        const faltan = ['ViewChannel', 'SendMessages', 'AttachFiles']
            .filter((p) => !permisos?.has(p));
        if (faltan.length) {
            console.error(
                `[guildMemberAdd] Al bot le faltan permisos en #${canal.name}: ${faltan.join(', ')}.`);
            return;
        }

        const contenido = MENSAJE(member);

        try {
            const png = await generarBanner({
                nombre:    member.user.username,
                avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
            });

            await canal.send({
                content: contenido,
                files: [new AttachmentBuilder(png, { name: 'welcome-banner.png' })],
            });
            console.log(`[guildMemberAdd] Banner enviado para ${member.user.tag}.`);

        } catch (error) {
            // Un solo mensaje: si el banner falla, el saludo sale igualmente en
            // texto, y nunca se envían los dos.
            console.error('[guildMemberAdd] Falló el renderizado del banner:', error);
            try {
                await canal.send({ content: contenido });
                console.log(`[guildMemberAdd] Enviado saludo de texto como fallback para ${member.user.tag}.`);
            } catch (fallo) {
                console.error('[guildMemberAdd] Tampoco se pudo enviar el fallback de texto:', fallo);
            }
        }
    },
};
