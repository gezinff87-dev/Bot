const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');

const app = express();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// CONFIGURAÇÃO EDITÁVEL - MUDE AQUI!
const CONFIG = {
    // Nome do seu negócio
    nome_negocio: "🌟 Loja Digital Premium",
    
    // Produtos disponíveis
    produtos: [
        {
            nome: "💎 Plano Premium",
            preco: "R$ 29,90",
            descricao: "Acesso vitalício a todos os recursos",
            id: "premium"
        },
        {
            nome: "🚀 Plano VIP", 
            preco: "R$ 49,90",
            descricao: "Recursos exclusivos + suporte prioritário",
            id: "vip"
        },
        {
            nome: "🎨 Design Personalizado",
            preco: "R$ 99,90", 
            descricao: "Design exclusivo para seu projeto",
            id: "design"
        }
    ],
    
    // Métodos de pagamento
    pagamentos: ["💳 Cartão", "📱 PIX", "🔗 PayPal"],
    
    // Contato para compras
    contato: "📧 seu-email@negocio.com",
    
    // Canais (precisa configurar no seu Discord)
    canal_pedidos: "📦・pedidos",
    canal_duvidas: "❓・dúvidas"
};

// Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('produtos')
        .setDescription('Ver todos os produtos disponíveis'),
    
    new SlashCommandBuilder()
        .setName('comprar')
        .setDescription('Comprar um produto')
        .addStringOption(option =>
            option.setName('produto')
                .setDescription('Escolha o produto')
                .setRequired(true)
                .addChoices(
                    ...CONFIG.produtos.map(p => ({ name: p.nome, value: p.id }))
                )),
    
    new SlashCommandBuilder()
        .setName('suporte')
        .setDescription('Falar com o suporte'),
    
    new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configurar o bot (apenas admin)')
        .addStringOption(option =>
            option.setName('opcao')
                .setDescription('O que configurar')
                .setRequired(true)
                .addChoices(
                    { name: 'Ver configuração', value: 'ver' },
                    { name: 'Resetar configuração', value: 'reset' }
                ))
];

// Registrar comandos
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
    console.log(`✅ ${client.user.tag} online!`);
    
    try {
        console.log('📡 Registrando slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash commands registrados!');
        
        // Status personalizado
        client.user.setActivity(`${CONFIG.nome_negocio} | /produtos`, { type: 'WATCHING' });
    } catch (error) {
        console.error('❌ Erro ao registrar commands:', error);
    }
});

// Comando: /produtos
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'produtos') {
        const embed = new EmbedBuilder()
            .setTitle(`🛍️ ${CONFIG.nome_negocio}`)
            .setDescription('**Confira nossos produtos disponíveis:**\n\n' +
                CONFIG.produtos.map(p => 
                    `**${p.nome}**\n💰 ${p.preco}\n📝 ${p.descricao}\n🆔 Código: \`${p.id}\`\n`
                ).join('\n'))
            .addFields(
                { name: '💳 Pagamentos', value: CONFIG.pagamentos.join(' • '), inline: true },
                { name: '📞 Contato', value: CONFIG.contato, inline: true }
            )
            .setColor(0x00FF00)
            .setFooter({ text: `Use /comprar para adquirir um produto!` });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🛒 Comprar Agora')
                    .setStyle(ButtonStyle.Success)
                    .setCustomId('comprar_btn')
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    // Comando: /comprar
    if (interaction.commandName === 'comprar') {
        const produtoId = interaction.options.getString('produto');
        const produto = CONFIG.produtos.find(p => p.id === produtoId);

        if (!produto) {
            return await interaction.reply({ content: '❌ Produto não encontrado!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎉 Pedido Confirmado!`)
            .setDescription(`**${produto.nome}**\n\n💰 **Preço:** ${produto.preco}\n📝 ${produto.descricao}`)
            .addFields(
                { name: '📞 Para finalizar a compra:', value: `Entre em contato: ${CONFIG.contato}` },
                { name: '💳 Métodos de pagamento:', value: CONFIG.pagamentos.join(', ') },
                { name: '🆔 Número do pedido:', value: `#${Math.random().toString(36).substr(2, 9).toUpperCase()}` }
            )
            .setColor(0xFFA500)
            .setTimestamp();

        // Envia para canal de pedidos se existir
        const canalPedidos = interaction.guild.channels.cache.find(ch => 
            ch.name === CONFIG.canal_pedidos.replace(/[^a-zA-Z0-9・]/g, '')
        );

        if (canalPedidos) {
            const pedidoEmbed = new EmbedBuilder()
                .setTitle('📦 NOVO PEDIDO')
                .setDescription(`**Cliente:** ${interaction.user.tag}\n**Produto:** ${produto.nome}`)
                .setColor(0x0099FF)
                .setTimestamp();
            
            canalPedidos.send({ embeds: [pedidoEmbed] });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Comando: /suporte
    if (interaction.commandName === 'suporte') {
        const embed = new EmbedBuilder()
            .setTitle('🛟 Suporte')
            .setDescription(`**Precisa de ajuda?**\n\n📧 **Email:** ${CONFIG.contato}\n💬 **Canal de dúvidas:** <#${interaction.guild.channels.cache.find(ch => ch.name === CONFIG.canal_duvidas.replace(/[^a-zA-Z0-9・]/g, ''))?.id || 'Não configurado'}>\n\n📋 **Antes de perguntar:**\n• Verifique os produtos com \`/produtos\`\n• Leia as #regras do servidor`)
            .setColor(0x0099FF);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Comando: /config (apenas admin)
    if (interaction.commandName === 'config') {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({ content: '❌ Apenas administradores podem usar este comando!', ephemeral: true });
        }

        const opcao = interaction.options.getString('opcao');

        if (opcao === 'ver') {
            const configEmbed = new EmbedBuilder()
                .setTitle('⚙️ Configuração Atual')
                .setDescription('```json\n' + JSON.stringify(CONFIG, null, 2) + '\n```')
                .setColor(0x3498DB)
                .setFooter({ text: 'Edite diretamente no arquivo bot.js' });

            await interaction.reply({ embeds: [configEmbed], ephemeral: true });
        }

        if (opcao === 'reset') {
            // Recarrega o bot (em produção precisa de restart)
            await interaction.reply({ content: '🔄 Reinicie o bot manualmente para aplicar mudanças no código!', ephemeral: true });
        }
    }
});

// Botão de compra rápida
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'comprar_btn') {
        const embed = new EmbedBuilder()
            .setTitle('🛒 Como Comprar')
            .setDescription(`**Para comprar, use:**\n\`/comprar\`\n\n**Ou entre em contato:**\n${CONFIG.contato}`)
            .addFields(
                { name: '📋 Produtos disponíveis', value: CONFIG.produtos.map(p => p.nome).join(', ') },
                { name: '💳 Pagamentos', value: CONFIG.pagamentos.join(', ') }
            )
            .setColor(0x9B59B6);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// Web server para Render
app.use(express.json());
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        bot: client.user?.tag || 'starting',
        negocio: CONFIG.nome_negocio,
        produtos: CONFIG.produtos.length
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
});

// Ping automático para evitar dormir
setInterval(() => {
    if (process.env.RENDER_URL) {
        require('https').get(process.env.RENDER_URL);
        console.log('🔄 Ping para manter online');
    }
}, 14 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server rodando na porta ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);