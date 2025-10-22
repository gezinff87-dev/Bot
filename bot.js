const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');

const app = express();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// CONFIGURAÇÃO - COLE SEUS IDs AQUI
const CONFIG = {
    colors: {
        primary: 0x5865F2,
        success: 0x57F287,
        warning: 0xFEE75C,
        error: 0xED4245
    },
    
    // 🔥 COLE SEUS IDs REAIS AQUI:
    roles: {
        support: '1427009496210739373',      // ID do cargo de suporte
        admin: '1410304623251554461'           // ID do cargo de admin
    },
    
    channels: {
        ticket_logs: '1424551958575845376',     // ID do canal de logs
        ticket_create: '1418009011386843226'   // ID do canal de criar tickets
    },
    
    categories: {
        open_tickets: '1418008982404071595',   // ID da categoria tickets abertos
        closed_tickets: '1430556193125830786' // ID da categoria tickets fechados
    },
    
    messages: {
        welcome_title: '🎪 Sistema de Tickets',
        welcome_description: 'Selecione o tipo de suporte abaixo:',
        ticket_created: '🎫 **Ticket Criado!**',
        close_confirm: '🔒 **Fechar Ticket?**'
    },
    
    ticket_types: [
        {
            label: '💼 Suporte Geral',
            description: 'Dúvidas gerais',
            emoji: '💼',
            value: 'general'
        },
        {
            label: '💰 Suporte Vendas',
            description: 'Ajuda com compras',
            emoji: '💰',
            value: 'sales'
        }
    ]
};

// Sistema de debug
function debug(message, data = null) {
    console.log(`🔍 DEBUG: ${message}`, data || '');
}

// Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Sistema de tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configurar sistema de tickets'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('debug')
                .setDescription('Verificar configuração do sistema'))
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const tickets = new Map();

client.on('ready', async () => {
    console.log(`🤖 Bot ${client.user.tag} online!`);
    
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Slash commands registrados!');
        client.user.setActivity('/ticket setup', { type: 'PLAYING' });
    } catch (error) {
        console.error('❌ Erro ao registrar commands:', error);
    }
});

// COMANDO: /ticket debug - VERIFICA A CONFIGURAÇÃO
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ticket') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'debug') {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            let debugInfo = '🔍 **DEBUG - CONFIGURAÇÃO DO SISTEMA**\n\n';

            // Verificar cargos
            debugInfo += '**👥 CARGOS:**\n';
            const supportRole = guild.roles.cache.get(CONFIG.roles.support);
            const adminRole = guild.roles.cache.get(CONFIG.roles.admin);
            
            debugInfo += `🎫 Suporte: ${supportRole ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'} (ID: ${CONFIG.roles.support})\n`;
            debugInfo += `👑 Admin: ${adminRole ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'} (ID: ${CONFIG.roles.admin})\n\n`;

            // Verificar canais
            debugInfo += '**📊 CANAIS:**\n';
            const logsChannel = guild.channels.cache.get(CONFIG.channels.ticket_logs);
            const createChannel = guild.channels.cache.get(CONFIG.channels.ticket_create);
            
            debugInfo += `📁 Logs: ${logsChannel ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'} (ID: ${CONFIG.channels.ticket_logs})\n`;
            debugInfo += `🎫 Criar: ${createChannel ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'} (ID: ${CONFIG.channels.ticket_create})\n\n`;

            // Verificar categorias
            debugInfo += '**📂 CATEGORIAS:**\n';
            const openCategory = guild.channels.cache.get(CONFIG.categories.open_tickets);
            const closedCategory = guild.channels.cache.get(CONFIG.categories.closed_tickets);
            
            debugInfo += `🎫 Abertos: ${openCategory ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'} (ID: ${CONFIG.categories.open_tickets})\n`;
            debugInfo += `📁 Fechados: ${closedCategory ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'} (ID: ${CONFIG.categories.closed_tickets})\n\n`;

            // Verificar permissões do bot
            debugInfo += '**🔐 PERMISSÕES DO BOT:**\n';
            const botMember = await guild.members.fetch(client.user.id);
            const hasAdmin = botMember.permissions.has(PermissionFlagsBits.Administrator);
            const hasManageChannels = botMember.permissions.has(PermissionFlagsBits.ManageChannels);
            const hasManageRoles = botMember.permissions.has(PermissionFlagsBits.ManageRoles);
            
            debugInfo += `👑 Administrador: ${hasAdmin ? '✅' : '❌'}\n`;
            debugInfo += `⚙️ Gerenciar Canais: ${hasManageChannels ? '✅' : '❌'}\n`;
            debugInfo += `👥 Gerenciar Cargos: ${hasManageRoles ? '✅' : '❌'}\n`;

            const embed = new EmbedBuilder()
                .setTitle('🔍 Debug do Sistema')
                .setDescription(debugInfo)
                .setColor(hasAdmin ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (subcommand === 'setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({ 
                    content: '❌ Apenas administradores podem usar este comando!', 
                    ephemeral: true 
                });
            }

            // VERIFICAR SE TUDO EXISTE ANTES DE CRIAR O PAINEL
            const guild = interaction.guild;
            let missingItems = [];

            const supportRole = guild.roles.cache.get(CONFIG.roles.support);
            const logsChannel = guild.channels.cache.get(CONFIG.channels.ticket_logs);
            const createChannel = guild.channels.cache.get(CONFIG.channels.ticket_create);
            const openCategory = guild.channels.cache.get(CONFIG.categories.open_tickets);
            const closedCategory = guild.channels.cache.get(CONFIG.categories.closed_tickets);

            if (!supportRole) missingItems.push('Cargo de Suporte');
            if (!logsChannel) missingItems.push('Canal de Logs');
            if (!createChannel) missingItems.push('Canal de Criar Ticket');
            if (!openCategory) missingItems.push('Categoria Tickets Abertos');
            if (!closedCategory) missingItems.push('Categoria Tickets Fechados');

            if (missingItems.length > 0) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Configuração Incompleta')
                    .setDescription(`**Itens não encontrados:**\n${missingItems.map(item => `• ${item}`).join('\n')}\n\nUse \`/ticket debug\` para ver detalhes.`)
                    .setColor(0xFF0000);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // SE TUDO EXISTIR, CRIAR O PAINEL
            const embed = new EmbedBuilder()
                .setTitle(CONFIG.messages.welcome_title)
                .setDescription(CONFIG.messages.welcome_description)
                .setColor(CONFIG.colors.primary);

            const selectMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket_type_select')
                        .setPlaceholder('🎫 Selecione o tipo de suporte...')
                        .addOptions(CONFIG.ticket_types)
                );

            await interaction.reply({ 
                content: '✅ Sistema configurado com sucesso!',
                ephemeral: true 
            });

            // Enviar para o canal de criação de tickets
            const targetChannel = guild.channels.cache.get(CONFIG.channels.ticket_create);
            if (targetChannel) {
                await targetChannel.send({ 
                    embeds: [embed], 
                    components: [selectMenu] 
                });
            } else {
                await interaction.channel.send({ 
                    embeds: [embed], 
                    components: [selectMenu] 
                });
            }
        }
    }
});

// RESTANTE DO CÓDIGO DOS TICKETS (MESMO DO ANTERIOR)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'ticket_type_select') {
        await interaction.deferReply({ ephemeral: true });

        const ticketType = interaction.values[0];
        const typeConfig = CONFIG.ticket_types.find(t => t.value === ticketType);
        const guild = interaction.guild;
        
        // VERIFICAR CATEGORIA
        const category = guild.channels.cache.get(CONFIG.categories.open_tickets);
        if (!category) {
            return await interaction.editReply({ 
                content: '❌ Categoria de tickets não encontrada! Use `/ticket debug` para verificar.' 
            });
        }

        // VERIFICAR CARGO DE SUPORTE
        const supportRole = guild.roles.cache.get(CONFIG.roles.support);
        if (!supportRole) {
            return await interaction.editReply({ 
                content: '❌ Cargo de suporte não encontrado! Use `/ticket debug` para verificar.' 
            });
        }

        // CRIAR TICKET
        try {
            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: supportRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });

            // Salvar ticket
            tickets.set(ticketChannel.id, {
                id: ticketChannel.id,
                author: interaction.user.id,
                type: ticketType,
                createdAt: new Date(),
                closed: false,
                claimed: false
            });

            // Embed do ticket
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎪 Ticket de Suporte')
                .setDescription(CONFIG.messages.ticket_created)
                .addFields(
                    { name: '📋 Tipo', value: typeConfig.label, inline: true },
                    { name: '👤 Autor', value: interaction.user.tag, inline: true },
                    { name: '🕐 Criado', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
                )
                .setColor(CONFIG.colors.primary);

            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('👋 Atender Ticket')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Fechar Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketChannel.send({ 
                content: `${interaction.user} ${supportRole}`,
                embeds: [welcomeEmbed], 
                components: [actionRow] 
            });

            await interaction.editReply({ 
                content: `✅ Ticket criado: ${ticketChannel}` 
            });

            // LOG
            const logChannel = guild.channels.cache.get(CONFIG.channels.ticket_logs);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📝 Ticket Criado')
                    .setColor(CONFIG.colors.success)
                    .addFields(
                        { name: '👤 Usuário', value: interaction.user.toString(), inline: true },
                        { name: '🎫 Ticket', value: ticketChannel.toString(), inline: true },
                        { name: '📋 Tipo', value: typeConfig.label, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erro ao criar ticket:', error);
            await interaction.editReply({ 
                content: '❌ Erro ao criar ticket. Verifique as permissões do bot.' 
            });
        }
    }
});

// BOTÕES (MESMO CÓDIGO ANTERIOR)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!tickets.has(interaction.channel.id)) return;

    const ticket = tickets.get(interaction.channel.id);

    if (interaction.customId === 'claim_ticket') {
        if (ticket.claimed) {
            return await interaction.reply({ 
                content: `❌ Já atendido por <@${ticket.claimedBy}>!`, 
                ephemeral: true 
            });
        }

        ticket.claimed = true;
        ticket.claimedBy = interaction.user.id;

        const claimEmbed = new EmbedBuilder()
            .setTitle('👋 Ticket Atendido')
            .setDescription(`${interaction.user} está atendendo!`)
            .setColor(CONFIG.colors.success);

        await interaction.reply({ embeds: [claimEmbed] });

        // Atualizar botão
        const updatedRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('✅ Atendido por ' + interaction.user.username)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.message.edit({ components: [updatedRow] });
    }

    if (interaction.customId === 'close_ticket') {
        const confirmEmbed = new EmbedBuilder()
            .setTitle('🔒 Fechar Ticket')
            .setDescription(CONFIG.messages.close_confirm)
            .setColor(CONFIG.colors.warning);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_close')
                    .setLabel('✅ Confirmar')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_close')
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
    }

    if (interaction.customId === 'confirm_close') {
        await closeTicket(interaction.channel, interaction.user);
        await interaction.message.edit({ content: '✅ Ticket fechado!', components: [] });
        await interaction.deferUpdate();
    }

    if (interaction.customId === 'cancel_close') {
        await interaction.message.delete();
    }
});

async function closeTicket(channel, closer) {
    const ticket = tickets.get(channel.id);
    if (!ticket) return;

    ticket.closed = true;
    ticket.closedBy = closer.id;

    // Mover para categoria fechada
    const closedCategory = channel.guild.channels.cache.get(CONFIG.categories.closed_tickets);
    if (closedCategory) {
        await channel.setParent(closedCategory.id);
    }

    await channel.permissionOverwrites.edit(channel.guild.id, {
        SendMessages: false
    });

    const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Fechado')
        .setDescription(`Fechado por ${closer}`)
        .setColor(CONFIG.colors.error);

    await channel.send({ embeds: [closeEmbed] });
}

// WEB SERVER
app.get('/', (req, res) => {
    res.json({ status: 'online', bot: client.user?.tag || 'starting' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server porta ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);           { name: '🆔 ID do Ticket', value: `\`${channel.id}\``, inline: true }
        );

    if (type) {
        logEmbed.addFields({ name: '📋 Tipo', value: type, inline: true });
    }

    if (action === 'closed') {
        const ticket = tickets.get(channel.id);
        if (ticket) {
            logEmbed.addFields(
                { name: '⏱️ Duração', value: formatDuration(ticket.closedAt - ticket.createdAt), inline: true }
            );
        }
    }

    logEmbed.setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
}

// FORMATAR DURAÇÃO
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// WEB SERVER PARA RENDER
app.use(express.json());
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        bot: client.user?.tag || 'starting',
        tickets: tickets.size,
        name: 'Ticket King'
    });
});

// Ping automático
setInterval(() => {
    if (process.env.RENDER_URL) {
        require('https').get(process.env.RENDER_URL);
    }
}, 14 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server rodando na porta ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
