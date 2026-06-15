const event = require('./events/guildMemberAdd.js');

// Mockear el objeto Member de discord.js
const mockMember = {
    user: {
        tag: 'LeadMember#1337',
        username: 'LeadMember',
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
    },
    guild: {
        channels: {
            cache: {
                get: (id) => ({
                    send: async (options) => {
                        console.log('\n--- SIMULACIÓN DE CANAL DE DISCORD ---');
                        console.log('Mensaje de texto:', options.content);
                        console.log('Archivo adjunto enviado:', options.files[0].name);
                        
                        // Guardar la imagen generada en el disco local para verificarla visualmente
                        const fs = require('fs');
                        const path = require('path');
                        const buffer = options.files[0].attachment;
                        
                        fs.writeFileSync(path.join(__dirname, 'mock-welcome-banner.png'), buffer);
                        console.log('Imagen PNG del banner guardada como: mock-welcome-banner.png');
                        console.log('-------------------------------------\n');
                    }
                })
            }
        }
    },
    toString: () => '@LeadMember'
};

console.log('Iniciando simulación del evento guildMemberAdd...');
event.execute(mockMember)
    .then(() => console.log('Simulación completada con éxito.'))
    .catch(err => console.error('Error durante la simulación:', err));
