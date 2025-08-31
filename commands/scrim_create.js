const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Team = require('../database/models/Team');
const Scrim = require('../database/models/Scrim');
const fs = require('fs');
const path = require('path');

function generateScrimId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_create')
    .setDescription('Create a new scrim match'),
  
  async execute(interaction) {
    try {
      // Handle slash command - show modal immediately without any delays
      if (interaction.isChatInputCommand()) {
        const modal = new ModalBuilder()
          .setCustomId('scrimCreateModal')
          .setTitle('╭─𝐍𝐞𝐰 𝐒𝐜𝐫𝐢𝐦 𝐂𝐡𝐚𝐥𝐥𝐞𝐧𝐠𝐞── ∘₊✧');
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('scrimDate')
              .setLabel('Date (YYYY-MM-DD)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('scrimTime')
              .setLabel('Time (e.g. 6pm, 2:30pm)')
              .setPlaceholder('e.g. 6pm, 2:30pm')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('scrimGames')
              .setLabel('Amount of Games')
              .setPlaceholder('e.g. 3')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('scrimOther')
              .setLabel('Additional Information (e.g banned mons)')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Any special rules, requirements, etc.')
              .setRequired(false)
          )
        );
        
        // Check if interaction is still valid before showing modal
        if (!interaction.isRepliable()) {
          console.log('Interaction expired before showing modal');
          return;
        }
        
        // Show modal immediately - no validation or checks that could cause delays
        try {
          await interaction.showModal(modal);
          console.log(`Modal shown successfully for interaction ${interaction.id}`);
          return;
        } catch (modalError) {
          console.error('Error showing modal:', modalError);
          return;
        }
      }
      
      // Handle modal submit
      if (interaction.isModalSubmit() && interaction.customId === 'scrimCreateModal') {
        await interaction.deferReply({ flags: 64 });
        
        // Check if user is in a team
        const userTeam = await Team.findOne({
          $or: [
            { leader: interaction.user.id },
            { 'members.userId': interaction.user.id }
          ],
          guildId: interaction.guild.id
        });
        
        if (!userTeam) {
          return await interaction.editReply({
            content: '❌ You must be in a team to create scrims.'
          });
        }
        
        const date = interaction.fields.getTextInputValue('scrimDate');
        const time = interaction.fields.getTextInputValue('scrimTime');
        const games = interaction.fields.getTextInputValue('scrimGames');
        const other = interaction.fields.getTextInputValue('scrimOther') || '';
        
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return await interaction.editReply({
            content: '❌ Invalid date format. Use YYYY-MM-DD'
          });
        }
        
        // Parse and validate time format - accept any reasonable format
        let parsedTime;
        try {
          // More flexible regex to accept various formats
          const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?$/;
          const match = time.trim().match(timeRegex);
          
          if (!match) {
            // Try 24-hour format without am/pm
            const time24Regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
            const match24 = time.trim().match(time24Regex);
            if (match24) {
              parsedTime = `${match24[1].padStart(2, '0')}:${match24[2]}`;
            } else {
              throw new Error('Invalid time format');
            }
          } else {
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2] || '0');
            const period = match[3] ? match[3].toLowerCase() : null;
            
            // Handle 12-hour format
            if (period === 'pm' && hours !== 12) hours += 12;
            if (period === 'am' && hours === 12) hours = 0;
            
            // Validate ranges
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              throw new Error('Invalid time values');
            }
            
            parsedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          }
        } catch (error) {
          return await interaction.editReply({
            content: '❌ Invalid time format. Use formats like: 6pm, 2:30pm, 14:30'
          });
        }
        
        // Generate unique scrim ID
        let scrimId;
        do {
          scrimId = generateScrimId();
        } while (await Scrim.findOne({ scrimId }));
        
        // Create timestamp for Discord
        let discordTimestamp = `${date} at ${time}`;
        try {
          const scrimDateTime = new Date(`${date}T${parsedTime}:00`);
          if (!isNaN(scrimDateTime.getTime())) {
            const unixTimestamp = Math.floor(scrimDateTime.getTime() / 1000);
            discordTimestamp = `<t:${unixTimestamp}:F>`;
          }
        } catch (error) {
          console.log('Date parsing error:', error);
        }
        
        // Create and save scrim
        const scrim = new Scrim({
          scrimId: scrimId,
          teamName: userTeam.name,
          teamLeader: userTeam.leader,
          teamMembers: userTeam.members.map(member => member.userId),
          date: date,
          time: time,
          games: games,
          otherInfo: other,
          status: 'open',
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          createdBy: interaction.user.id,
          createdAt: new Date()
        });
        
        await scrim.save();
        
        // Get the dedicated scrim channel
        const channelPath = path.join(__dirname, '../data/scrim_channel.json');
        let scrimChannelId = null;
        const defaultGifUrl = 'https://i.imgur.com/xYZbizx.gif';
        
        try {
          if (fs.existsSync(channelPath)) {
            const channelData = JSON.parse(fs.readFileSync(channelPath, 'utf8'));
            scrimChannelId = channelData.channelId;
          }
        } catch (error) {
          console.log('Error reading scrim channel config:', error);
        }
        
        // Require dedicated scrim channel - don't allow fallback
        if (!scrimChannelId) {
          return await interaction.editReply({
            content: '❌ No dedicated scrim channel has been set. Please ask an admin to use `/scrim_channel` to set one first.'
          });
        }
        
        const scrimChannel = interaction.guild.channels.cache.get(scrimChannelId);
        if (!scrimChannel) {
          return await interaction.editReply({
            content: '❌ The configured scrim channel no longer exists. Please ask an admin to use `/scrim_channel` to set a new one.'
          });
        }
        
        // Use default embed settings
        const embedTitle = '╭─𝐍𝐞𝐰 𝐒𝐜𝐫𝐢𝐦 𝐂𝐡𝐚𝐥𝐥𝐞𝐧𝐠𝐞── ∘₊✧';
        const embedColor = 0x00AE86;
        
        // Build description
        const description = `🏆 **Team:** ${userTeam.name}\n` +
                           `📅 **Date & Time:** ${discordTimestamp}\n` +
                           `🎮 **Games:** ${games}\n` +
                           `📝 **Additional Info:** ${other || 'None specified'}\n\n` +
                           `*Click the button below to accept this scrim challenge!*`;
        
        // Create scrim post embed
        const scrimEmbed = new EmbedBuilder()
          .setTitle(embedTitle)
          .setDescription(description)
          .setColor(embedColor)
          .setThumbnail(interaction.guild.iconURL())
          .addFields(
            { name: '🆔 Scrim ID', value: `\`${scrimId}\``, inline: true },
            { name: '👑 Team Leader', value: `<@${userTeam.leader}>`, inline: true }
          )
          .setTimestamp()
          .setFooter({ 
            text: `Created by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setImage(defaultGifUrl)
        
        const acceptButton = new ButtonBuilder()
          .setCustomId(`scrimAccept_${scrimId}`)
          .setLabel('⚔️ Accept Scrim')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(acceptButton);
        
        // Send scrim embed
        const scrimMessage = await scrimChannel.send({ 
          embeds: [scrimEmbed], 
          components: [row] 
        });
        
        
        
        // Store the message ID and channel ID for deletion later
        scrim.messageId = scrimMessage.id;
        scrim.scrimPostChannelId = scrimChannel.id;
        await scrim.save();
        
        // Confirm to the user
        await interaction.editReply({
          content: `✅ Scrim **${scrimId}** created successfully!\n\n**Team:** ${userTeam.name}\n**Date:** ${date}\n**Time:** ${time}\n**Games:** ${games}${other ? `\n**Additional Info:** ${other}` : ''}${discordTimestamp ? `\n\n${discordTimestamp}` : ''}`
        });
        
        console.log(`Successfully created scrim ${scrimId} for team ${userTeam.name}`);
        return;
      }
    } catch (error) {
      console.error('Scrim create error:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ An error occurred while creating the scrim: ${error.message}`,
          flags: 64
        });
      } else {
        await interaction.editReply({
          content: `❌ An error occurred while creating the scrim: ${error.message}`
        });
      }
    }
  }
};
