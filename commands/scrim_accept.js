const Team = require('../database/models/Team');
const Scrim = require('../database/models/Scrim');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_accept')
    .setDescription('Accept a scrim')
    .addStringOption(option =>
      option.setName('scrim_id')
        .setDescription('Scrim ID to accept')
        .setRequired(true)),
  
  async execute(interaction) {
    try {
      // Defer reply to prevent timeout
      await interaction.deferReply({ flags: 64 });

      const scrimId = interaction.options.getString('scrim_id');
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Find the user's team (they can be leader or member)
      const team = await Team.findOne({
        $or: [
          { leader: userId },
          { 'members.userId': userId }
        ],
        guildId: guildId
      });

      if (!team) {
        return await interaction.editReply({
          content: '❌ You must be in a team to accept scrims. Create a team first or get invited to one.'
        });
      }

      // Check if user is the team leader (only leaders can accept scrims)
      if (team.leader !== userId) {
        return await interaction.editReply({
          content: '❌ Only team leaders can accept scrims.'
        });
      }


      // Find the scrim to accept
      const scrim = await Scrim.findOne({
        scrimId: scrimId,
        guildId: guildId,
        status: 'open'
      });

      if (!scrim) {
        return await interaction.editReply({
          content: `❌ Scrim with ID **${scrimId}** not found or already accepted.`
        });
      }

      // Check if team is trying to accept their own scrim
      if (scrim.teamLeader === userId || scrim.teamMembers.includes(userId)) {
        return await interaction.editReply({
          content: '❌ You cannot accept your own team\'s scrim!'
        });
      }

      // Update scrim status to accepted and store opposing team info
      scrim.status = 'accepted';
      scrim.opposingTeamName = team.name;
      scrim.opposingTeamLeader = team.leader;
      scrim.opposingTeamMembers = team.members.map(member => member.userId);
      await scrim.save();

        // Create private channel for both teams
        const channelName = `${scrim.teamName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-vs-${team.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${scrimId}`;
      
      try {
        const guild = interaction.guild;
        
        // Build permission overwrites array
        const permissionOverwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          }
        ];

        // Add permissions for original scrim team (creator) - avoid duplicates
        const originalTeamMembers = [...new Set([scrim.teamLeader, ...scrim.teamMembers])];
        for (const memberId of originalTeamMembers) {
          try {
            const guildMember = await guild.members.fetch(memberId);
            if (guildMember) {
              permissionOverwrites.push({
                id: memberId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles
                ],
              });
            }
          } catch (fetchError) {
            console.log(`Could not fetch original team member ${memberId}:`, fetchError.message);
          }
        }

        // Add permissions for accepting team - avoid duplicates
        const acceptingTeamMembers = [...new Set([team.leader, ...team.members.map(m => m.userId)])];
        for (const memberId of acceptingTeamMembers) {
          try {
            const guildMember = await guild.members.fetch(memberId);
            if (guildMember) {
              permissionOverwrites.push({
                id: memberId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles
                ],
              });
            }
          } catch (fetchError) {
            console.log(`Could not fetch accepting team member ${memberId}:`, fetchError.message);
          }
        }

        // Create the scrim channel
        const scrimChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          permissionOverwrites: permissionOverwrites,
        });

        // Create welcome embed for the scrim channel
        const welcomeEmbed = new EmbedBuilder()
          .setTitle('🎯 Scrim Match Created!')
          .setDescription(`**${scrim.teamName}** vs **${team.name}**`)
          .addFields([
            { name: '🆔 Scrim ID', value: `\`${scrimId}\``, inline: true },
            { name: '📅 Date', value: scrim.date, inline: true },
            { name: '⏰ Time', value: scrim.time, inline: true },
            { name: '🎮 Games', value: scrim.games.toString(), inline: true },
            { name: '📝 Additional Info', value: scrim.otherInfo || 'None specified', inline: false },
            { 
              name: `👥 ${scrim.teamName}`, 
              value: `<@${scrim.teamLeader}> (Leader)\n${scrim.teamMembers.map(id => `<@${id}>`).join('\n')}`, 
              inline: true 
            },
            { 
              name: `👥 ${team.name}`, 
              value: `<@${team.leader}> (Leader)\n${team.members.map(m => `<@${m.userId}>`).join('\n')}`, 
              inline: true 
            }
          ])
          .setColor(0x00FF00)
          .setTimestamp()
          .setThumbnail('https://cdn.discordapp.com/attachments/1316020606101774376/1318464842424836116/image.png')
          .setFooter({ text: 'Good luck to both teams! 🔥' });

        // Create cancel button for the scrim channel
        const cancelRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`scrimCancel_${scrimId}`)
              .setLabel('Cancel Scrim')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌')
          );

        // Send welcome message to the scrim channel
        await scrimChannel.send({ 
          embeds: [welcomeEmbed],
          components: [cancelRow],
          content: `${originalTeamMembers.map(id => `<@${id}>`).join(' ')} ${acceptingTeamMembers.map(id => `<@${id}>`).join(' ')}\n\n` +
                   `**Scrim is ready!** Use this channel to coordinate your match.\n` +
                   `When finished, use \`/scrim_finish ${scrimId}\` to close this scrim.`
        });

        // Success response
        await interaction.editReply({
          content: `✅ **Scrim ${scrimId} accepted successfully!**\n\n` +
                   `**Match:** ${team.name} vs ${scrim.teamName}\n` +
                   `**Private Channel:** ${scrimChannel}\n` +
                   `**Date:** ${scrim.date} at ${scrim.time}\n\n` +
                   `Good luck in your scrim! 🔥`
        });

        // Try to update the original scrim message if it exists
        try {
          if (scrim.messageId && scrim.channelId) {
            const originalChannel = guild.channels.cache.get(scrim.channelId);
            if (originalChannel) {
              const originalMessage = await originalChannel.messages.fetch(scrim.messageId);
              if (originalMessage) {
                const updatedEmbed = new EmbedBuilder()
                  .setTitle('✅ **SCRIM ACCEPTED!**')
                  .setDescription(`This scrim has been accepted by **${team.name}**!`)
                  .addFields([
                    { name: 'Match', value: `${scrim.teamName} vs ${team.name}`, inline: false },
                    { name: 'Status', value: 'Match in progress', inline: true },
                    { name: 'Scrim ID', value: scrimId, inline: true }
                  ])
                  .setColor(0x808080)
                  .setTimestamp()
                  .setThumbnail('https://cdn.discordapp.com/attachments/1316020606101774376/1318464842424836116/image.png');
                
                await originalMessage.edit({ embeds: [updatedEmbed], components: [] });
              }
            }
          }
        } catch (updateError) {
          console.log('Could not update original scrim message:', updateError.message);
        }

      } catch (channelError) {
        console.error('Error creating scrim channel:', channelError);
        
        // Still mark scrim as accepted even if channel creation fails
        await interaction.editReply({
          content: `✅ Scrim **${scrimId}** accepted by team **${team.name}**!\n` +
                   `**Match:** ${team.name} vs ${scrim.teamName}\n` +
                   `❌ Could not create private channel. Please contact an administrator.\n\n` +
                   `**Error:** ${channelError.message}`
        });
      }

    } catch (error) {
      console.error('Error accepting scrim:', error);
      
      // Handle different response states
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: `❌ An error occurred while accepting the scrim: ${error.message}`,
          flags: 64
        });
      } else {
        await interaction.editReply({
          content: `❌ An error occurred while accepting the scrim: ${error.message}`
        });
      }
    }
  }
};