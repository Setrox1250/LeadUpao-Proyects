const { Events, AttachmentBuilder } = require('discord.js');
const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');
const path = require('path');

// Cargar la fuente Roboto-Regular para Puppeteer
const fontPath = path.join(__dirname, '../templates/Roboto-Regular.ttf');
const fontBase64 = fs.readFileSync(fontPath).toString('base64');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        // ID real del canal de bienvenidas de LEAD UPAO
        const channelId = '1510689444716347482'; 
        let channel = member.guild.channels.cache.get(channelId);
        
        // Fallback en desarrollo en caso de que el ID del canal real no esté presente en la caché del bot
        if (!channel) {
            channel = member.guild.systemChannel || member.guild.channels.cache.find(ch =>
                ch.name.toLowerCase() === 'bienvenidas' ||
                ch.name.toLowerCase() === 'welcome' ||
                ch.name.toLowerCase() === 'bienvenida'
            );
        }
        
        if (!channel) return;

        const username = member.user.username.toUpperCase();
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        
        // Ajuste inteligente para nombres extremadamente largos
        const fontSize = username.length > 15 ? '34px' : '48px';

        try {
            const htmlTemplate = `
            <html>
            <head>
                <style>
                    @font-face {
                        font-family: 'Roboto';
                        src: url('data:font/truetype;charset=utf-8;base64,${fontBase64}') format('truetype');
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        font-family: 'Roboto', sans-serif;
                        background: transparent;
                        width: 1000px;
                        height: 500px;
                    }
                </style>
            </head>
            <body>
                <div style="
                    position: relative;
                    width: 1000px;
                    height: 500px;
                    display: flex;
                    align-items: center;
                    padding: 0 90px;
                    background-color: #030C40;
                    background-image: linear-gradient(135deg, #030C40 0%, #110e52 40%, #1f0b4d 100%);
                    overflow: hidden;
                ">
                    <div style="position: absolute; top: -100px; left: -100px; width: 450px; height: 700px; background: #7957F2; border-radius: 40% 60% 60% 40% / 50% 30% 70% 50%; opacity: 0.85;"></div>
                    <div style="position: absolute; top: -50px; left: -50px; width: 400px; height: 600px; background: #A6249D; border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%; opacity: 0.4;"></div>
                    
                    <div style="position: absolute; top: 80px; right: 180px; width: 45px; height: 45px; background: linear-gradient(135deg, #A6249D, #7957F2); border-radius: 50%; filter: drop-shadow(0 0 10px rgba(121,87,242,0.5));"></div>
                    <div style="position: absolute; top: 180px; right: 100px; width: 85px; height: 85px; background: linear-gradient(135deg, #A6249D, #7957F2); border-radius: 50%; filter: drop-shadow(0 0 20px rgba(166,36,157,0.6));"></div>
                    <div style="position: absolute; top: 310px; right: 140px; width: 35px; height: 35px; background: linear-gradient(135deg, #A6249D, #7957F2); border-radius: 50%; filter: drop-shadow(0 0 8px rgba(121,87,242,0.4));"></div>

                    <div style="position: absolute; bottom: 60px; right: 100px; color: rgba(255,255,255,0.7); font-size: 40px;">✦</div>

                    <div style="position: absolute; top: 35px; left: 45px; display: flex; align-items: center; z-index: 10;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 900; color: #ffffff; font-size: 26px; letter-spacing: 2px; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);">LEAD | UPAO</span>
                            <span style="font-size: 10px; color: rgba(255,255,255,0.8); font-weight: 700; letter-spacing: 2.5px; margin-top: 2px; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);">LEARN. EXPLORE. ASPIRE. DISCOVER</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; width: 100%; margin-top: 50px;">
                        
                        <div style="
                            width: 250px;
                            height: 250px;
                            border-radius: 50%;
                            padding: 6px;
                            background: linear-gradient(135deg, #D93240, #A6249D, #7957F2);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 0 30px rgba(166, 36, 157, 0.5);
                        ">
                            <img src="${avatarURL}" style="width: 238px; height: 238px; border-radius: 50%; border: 6px solid #030C40; object-fit: cover;" />
                        </div>

                        <div style="display: flex; flex-direction: column; padding-left: 55px; max-width: 520px;">
                            <h1 style="font-size: 76px; font-weight: 400; color: #ffffff; margin: 0; line-height: 0.9; letter-spacing: 3px;">
                                BIENVENID@
                            </h1>
                            <h2 style="font-size: ${fontSize}; font-weight: 800; color: #ffffff; margin: 10px 0 0 0; line-height: 1.1; letter-spacing: -0.5px; opacity: 0.95; word-break: break-all;">
                                ${username}
                            </h2>
                        </div>

                    </div>
                </div>
            </body>
            </html>
            `;

            // Renderizar el HTML a Buffer PNG usando node-html-to-image
            const imageBuffer = await nodeHtmlToImage({
                html: htmlTemplate,
                type: 'png',
                transparent: true
            });

            const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-banner.png' });

            // Enviar el mensaje con el archivo adjunto al canal
            await channel.send({
                content: `¡Bienvenido(a) ${member} a **LEAD UPAO**! 🎉 Pasa por el canal de verificación para darte de alta de forma oficial.`,
                files: [attachment]
            });

            console.log(`[guildMemberAdd] Banner de bienvenida dinámico enviado exitosamente para ${member.user.tag}`);

        } catch (error) {
            console.error('Error procesando el banner de bienvenida:', error);
            
            // Fallback de texto simple si falla el renderizado
            try {
                await channel.send({
                    content: `¡Bienvenido(a) ${member} a **LEAD UPAO**! 🎉 Pasa por el canal de verificación para darte de alta de forma oficial.`
                });
                console.log(`[guildMemberAdd] Enviado mensaje de bienvenida de texto simple como fallback para ${member.user.tag}`);
            } catch (fallbackError) {
                console.error('Error al enviar el mensaje de fallback:', fallbackError);
            }
        }
    }
};
