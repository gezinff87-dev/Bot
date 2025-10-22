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

// CONFIGURAÇÃO - EDITÁVEL COMO O TICKET KING
const CONFIG = {
    // Cores dos embeds
    colors: {
        primary: 0x5865F2,    // Azul Discord
        success: 0x57F287,    // Verde
        warning: 0xFEE75C,    // Amarelo  
        error: 0xED4245       // Vermelho
    },
    
    // Cargos
    roles: {
        support: '1427009496210739373',     // Cargo da equipe de suporte
        admin: '1410304623251554461'  // Cargo de admin
    },
    
    // Canais
    channels: {
        ticket_logs: '1424551958575845376',    // Logs de tickets
        ticket_create: '1418009011386843226'  // Canal para criar tickets
    },
    
    // Categorias
    categories: {
        open_tickets: '1418008982404071595',
        closed_tickets: '1424551958575845376'
    },
    
    // Mensagens e textos
    messages: {
        welcome_title: '🎪 Bem-vindo ao Ticket King!',
        welcome_description: '**Sua jornada de suporte começa aqui!**\n\n📋 **Como funciona:**\n• Escolha o tipo de suporte abaixo\n• Um canal privado será criado\n• Nossa equipe te ajudará em breve\n\n⚡ **Suporte rápido e eficiente!**',
        ticket_created: '🎫 **Ticket Criado!**\n\n📝 **Detalhes do ticket:**\n• **Autor:** {user}\n• **Tipo:** {type}\n• **Data:** {date}\n\n🔒 **Este canal é privado** e apenas você e nossa equipe têm acesso.',
        close_confirm: '🔒 **Fechar Ticket**\n\nTem certeza que deseja fechar este ticket?'
    },
    
    // Tipos de ticket (igual Ticket King)
    ticket_types: [
        {
            label: '💼 Suporte Geral',
            description: 'Dúvidas e problemas gerais',
            emoji: '💼',
            value: 'general'
        },
        {
            label: '💰 Suporte de Vendas',
            description: 'Ajuda com compras e pagamentos',
            emoji: '💰', 
            value: 'sales'
        },
        {
            label: '🚨 Reportar Problema',
            description: 'Reportar bugs e problemas técnicos',
            emoji: '🚨',
            value: 'report'
        },
        {
            label: '🤝 Parceria',
            description: 'Solicitar parceria ou colaboração',
            emoji: '🤝',
            value: 'partnership'
        }
    ]
};

// Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Configurar sistema de tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configurar painel de tickets'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Fechar ticket atual'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adicionar usuário ao ticket')
                .addUserOption(option =>
                    option.setName('usuário')
                        .setDescription('Usuário para adicionar')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remover usuário do ticket')
                .addUserOption(option =>
                    option.setName('usuário')
                        .setDescription('Usuário para remover')
                        .setRequired(true)))
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Sistema de tickets em memória
const tickets = new Map();

client.on('ready', async () => {
    console.log(`🎪 Ticket King ${client.user.tag} online!`);
    
    try {
        console.log('📡 Registrando slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash commands registrados!');
        
        client.user.setActivity('🎫 Ticket King | /ticket', { type: 'PLAYING' });
    } catch (error) {
        console.error('❌ Erro ao registrar commands:', error);
    }
});

// COMANDO: /ticket setup
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'ticket') {
        const subcommand = interaction.options.getSubcommand();

        // Verificar permissões
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: '❌ Apenas administradores podem usar este comando!', 
                ephemeral: true 
            });
        }

        if (subcommand === 'setup') {
            const embed = new EmbedBuilder()
                .setTitle(CONFIG.messages.welcome_title)
                .setDescription(CONFIG.messages.welcome_description)
                .setColor(CONFIG.colors.primary)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'Ticket King • Suporte Profissional', iconURL: client.user.displayAvatarURL() });

            const selectMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket_type_select')
                        .setPlaceholder('🎫 Selecione o tipo de suporte...')
                        .addOptions(CONFIG.ticket_types)
                );

            await interaction.reply({ 
                content: '✅ Painel de tickets configurado com sucesso!',
                ephemeral: true 
            });

            // Envia o painel no canal atual
            await interaction.channel.send({ 
                embeds: [embed], 
                components: [selectMenu] 
            });
        }

        if (subcommand === 'close') {
            if (!tickets.has(interaction.channel.id)) {
                return await interaction.reply({ 
                    content: '❌ Este canal não é um ticket!', 
                    ephemeral: true 
                });
            }

            const confirmEmbed = new EmbedBuilder()
                .setTitle('🔒 Fechar Ticket')
                .setDescription(CONFIG.messages.close_confirm)
                .setColor(CONFIG.colors.warning);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_close')
                        .setLabel('✅ Confirmar Fechamento')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel_close')
                        .setLabel('❌ Cancelar')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.reply({ 
                embeds: [confirmEmbed], 
                components: [row],
                ephemeral: true 
            });
        }

        if (subcommand === 'add') {
            const user = interaction.options.getUser('usuário');
            const ticket = tickets.get(interaction.channel.id);

            if (!ticket) {
                return await interaction.reply({ 
                    content: '❌ Este canal não é um ticket!', 
                    ephemeral: true 
                });
            }

            await interaction.channel.permissionOverwrites.create(user, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            await interaction.reply({ 
                content: `✅ ${user} foi adicionado ao ticket!`,
                ephemeral: true 
            });
        }

        if (subcommand === 'remove') {
            const user = interaction.options.getUser('usuário');
            const ticket = tickets.get(interaction.channel.id);

            if (!ticket) {
                return await interaction.reply({ 
                    content: '❌ Este canal não é um ticket!', 
                    ephemeral: true 
                });
            }

            await interaction.channel.permissionOverwrites.delete(user);

            await interaction.reply({ 
                content: `✅ ${user} foi removido do ticket!`,
                ephemeral: true 
            });
        }
    }
});

// MENU DE SELEÇÃO DE TICKET
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'ticket_type_select') {
        await interaction.deferReply({ ephemeral: true });

        const ticketType = interaction.values[0];
        const typeConfig = CONFIG.ticket_types.find(t => t.value === ticketType);
        
        // Encontrar categoria de tickets abertos
        const category = interaction.guild.channels.cache.find(
            ch => ch.type === ChannelType.GuildCategory && ch.name === CONFIG.categories.open_tickets
        );

        // Criar canal do ticket
        const ticketChannel = await interaction.guild.channels.create({
            name: `🎫-${typeConfig.value}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category?.id,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                },
                {
                    id: client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ManageChannels
                    ]
                }
            ]
        });

        // Adicionar equipe de suporte
        const supportRole = interaction.guild.roles.cache.find(r => r.name === CONFIG.roles.support);
        if (supportRole) {
            await ticketChannel.permissionOverwrites.create(supportRole, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
        }

        // Salvar ticket
        tickets.set(ticketChannel.id, {
            id: ticketChannel.id,
            author: interaction.user.id,
            type: ticketType,
            createdAt: new Date(),
            closed: false
        });

        // Embed de boas-vindas
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎪 Ticket King - Suporte')
            .setDescription(CONFIG.messages.ticket_created
                .replace('{user}', interaction.user.toString())
                .replace('{type}', typeConfig.label)
                .replace('{date}', new Date().toLocaleString('pt-BR')))
            .addFields(
                { name: '📋 Tipo de Suporte', value: typeConfig.label, inline: true },
                { name: '👤 Autor', value: interaction.user.tag, inline: true },
                { name: '🕐 Criado em', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
            )
            .setColor(CONFIG.colors.primary)
            .setFooter({ text: 'A equipe de suporte será com você em breve!' });

        // Botões de ação
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 Fechar Ticket')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('👋 Atender Ticket')
                    .setStyle(ButtonStyle.Primary)
            );

        await ticketChannel.send({ 
            content: `${interaction.user} ${supportRole ? supportRole.toString() : ''}`,
            embeds: [welcomeEmbed], 
            components: [actionRow] 
        });

        await interaction.editReply({ 
            content: `✅ Ticket criado com sucesso! ${ticketChannel}` 
        });

        // Log no canal de logs
        await logTicketAction(interaction.guild, 'created', interaction.user, ticketChannel, typeConfig.label);
    }
});

// BOTÕES DE TICKET
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const ticket = tickets.get(interaction.channel.id);
    if (!ticket) return;

    if (interaction.customId === 'close_ticket') {
        const confirmEmbed = new EmbedBuilder()
            .setTitle('🔒 Fechar Ticket')
            .setDescription(CONFIG.messages.close_confirm)
            .setColor(CONFIG.colors.warning);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_close')
                    .setLabel('✅ Confirmar Fechamento')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_close')
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({ 
            embeds: [confirmEmbed], 
            components: [row],
            ephemeral: true 
        });
    }

    if (interaction.customId === 'claim_ticket') {
        if (ticket.claimed) {
            return await interaction.reply({ 
                content: `❌ Este ticket já está sendo atendido por <@${ticket.claimedBy}>!`, 
                ephemeral: true 
            });
        }

        ticket.claimed = true;
        ticket.claimedBy = interaction.user.id;

        const claimEmbed = new EmbedBuilder()
            .setTitle('👋 Ticket Atendido')
            .setDescription(`${interaction.user} está atendendo este ticket!`)
            .setColor(CONFIG.colors.success)
            .setTimestamp();

        await interaction.reply({ embeds: [claimEmbed] });
        await interaction.message.components[0].components[1].setDisabled(true);
        
        await logTicketAction(interaction.guild, 'claimed', interaction.user, interaction.channel);
    }

    if (interaction.customId === 'confirm_close') {
        await closeTicket(interaction.channel, interaction.user);
        await interaction.update({ 
            content: '✅ Ticket fechado com sucesso!', 
            components: [],
            embeds: [] 
        });
    }

    if (interaction.customId === 'cancel_close') {
        await interaction.update({ 
            content: '❌ Fechamento cancelado.', 
            components: [],
            embeds: [] 
        });
    }
});

// FUNÇÃO PARA FECHAR TICKET
async function closeTicket(channel, closer) {
    const ticket = tickets.get(channel.id);
    if (!ticket) return;

    ticket.closed = true;
    ticket.closedAt = new Date();
    ticket.closedBy = closer.id;

    // Mover para categoria de fechados
    const closedCategory = channel.guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildCategory && ch.name === CONFIG.categories.closed_tickets
    );

    if (closedCategory) {
        await channel.setParent(closedCategory.id);
    }

    // Remover permissões de escrever
    await channel.permissionOverwrites.edit(channel.guild.id, {
        SendMessages: false
    });

    // Embed de fechamento
    const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Fechado')
        .setDescription(`Este ticket foi fechado por ${closer}`)
        .addFields(
            { name: '📅 Criado em', value: `<t:${Math.floor(ticket.createdAt/1000)}:F>`, inline: true },
            { name: '📅 Fechado em', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
            { name: '⏱️ Duração', value: formatDuration(Date.now() - ticket.createdAt), inline: true }
        )
        .setColor(CONFIG.colors.error)
        .setTimestamp();

    await channel.send({ embeds: [closeEmbed] });

    // Log
    await logTicketAction(channel.guild, 'closed', closer, channel);
}

// FUNÇÃO DE LOG
async function logTicketAction(guild, action, user, channel, type = null) {
    const logChannel = guild.channels.cache.find(ch => ch.name === CONFIG.channels.ticket_logs);
    if (!logChannel) return;

    const actionColors = {
        created: CONFIG.colors.success,
        claimed: CONFIG.colors.primary,
        closed: CONFIG.colors.error
    };

    const actionTexts = {
        created: 'criado',
        claimed: 'atendido', 
        closed: 'fechado'
    };

    const logEmbed = new EmbedBuilder()
        .setTitle(`📝 Ticket ${actionTexts[action]}`)
        .setColor(actionColors[action] || CONFIG.colors.primary)
        .addFields(
            { name: '👤 Usuário', value: user.toString(), inline: true },
            { name: '🎫 Ticket', value: channel.toString(), inline: true },
            { name: '🆔 ID do Ticket', value: `\`${channel.id}\``, inline: true }
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