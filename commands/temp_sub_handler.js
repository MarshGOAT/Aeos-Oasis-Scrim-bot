const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Team = require('../database/models/Team');

module.exports = {
  name: 'temp_sub_handler',
  async execute(interaction) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ flags: 64 });
    }

    try {
      const customId = interaction.customId;
      const isAccept = customId.startsWith('tempSubAccept_');
      const inviteId = customId.replace('tempSubAccept_', '').replace('tempSubDecline_', '');

      // Find the team with this pending temp sub invite
      const team = await Team.findOne({
        pendingTempSubs: { $elemMatch: { inviteId: inviteId } }
      });

      if (!team) {
        return await interaction.editReply({
          content: '❌ This temp sub invitation is no longer valid or has already been processed.'
        });
      }

      // Find the specific invite
      const invite = team.pendingTempSubs.find(inv => inv.inviteId === inviteId);
      if (!invite) {
        return await interaction.editReply({
          content: '❌ This temp sub invitation could not be found.'
        });
      }

      // Verify the user is the one who was invited
      if (invite.userId !== interaction.user.id) {
        return await interaction.editReply({
          content: '❌ This invitation is not for you.'
        });
      }

      // Remove the invite from pending list
      team.pendingTempSubs = team.pendingTempSubs.filter(inv => inv.inviteId !== inviteId);

      if (isAccept) {
        // Allow users from other teams to act as temporary substitutes

        // Add user as temporary substitute (separate from regular members)
        if (!team.activeTempSubs) {
          team.activeTempSubs = [];
        }
        
        const tempSubMember = {
          userId: interaction.user.id,
          username: interaction.user.username,
          scrimId: invite.scrimId,
          joinedAt: new Date()
        };

        team.activeTempSubs.push(tempSubMember);
        await team.save();

        // Add user to scrim channel and any other active scrim channels for this team
        let channelAccess = '';
        try {
          const guild = interaction.client.guilds.cache.get(invite.guildId);
          if (guild) {
            const Scrim = require('../database/models/Scrim');
            
            // Find all active scrim channels for this team
            const activeScrimChannels = await Scrim.find({
              $or: [
                { teamName: team.name, status: 'accepted' },
                { opposingTeamName: team.name, status: 'accepted' }
              ],
              guildId: invite.guildId,
              channelId: { $exists: true, $ne: null }
            });

            let addedChannels = [];
            for (const scrim of activeScrimChannels) {
              try {
                const channel = guild.channels.cache.get(scrim.channelId);
                if (channel) {
                  await channel.permissionOverwrites.create(interaction.user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                  });
                  addedChannels.push(channel.name);
                }
              } catch (channelError) {
                console.error(`Error adding temp sub to scrim channel:`, channelError);
              }
            }

            if (addedChannels.length > 0) {
              channelAccess = `\n🔓 **Channel Access:** Added to ${addedChannels.length} scrim channel(s)`;
            } else {
              channelAccess = '\n⚠️ **Channel Access:** No active scrim channels found';
            }
          }
        } catch (channelError) {
          console.log('Could not add channel permissions:', channelError.message);
          channelAccess = '\n⚠️ **Channel Access:** Could not automatically add to scrim channels';
        }

        // Disable buttons
        const disabledRow = interaction.message.components[0];
        disabledRow.components.forEach(button => button.data.disabled = true);

        await interaction.editReply({
          content: `✅ You have accepted the temporary substitute invitation for **${team.name}**!${channelAccess}\n\nYou will be automatically removed from the team after the scrim is completed.`
        });

        // Update the original message to show it was accepted
        try {
          await interaction.message.edit({
            content: '✅ **Invitation Accepted**',
            embeds: interaction.message.embeds,
            components: [disabledRow]
          });
        } catch (e) {
          console.log('Could not update original message:', e.message);
        }

        // Notify the team leader
        try {
          const guild = interaction.client.guilds.cache.get(invite.guildId);
          const leader = await guild.members.fetch(team.leader);
          
          const notificationEmbed = new EmbedBuilder()
            .setTitle('✅ Temp Sub Invitation Accepted')
            .setDescription(`**${interaction.user.username}** has accepted the temporary substitute invitation for **${team.name}**.`)
            .setColor(0x00FF00)
            .setTimestamp();

          await leader.send({ embeds: [notificationEmbed] });
        } catch (e) {
          console.log('Could not notify team leader:', e.message);
        }

      } else {
        // Decline
        await team.save(); // Save to remove the pending invite

        // Disable buttons
        const disabledRow = interaction.message.components[0];
        disabledRow.components.forEach(button => button.data.disabled = true);

        await interaction.editReply({
          content: `❌ You have declined the temporary substitute invitation for **${team.name}**.`
        });

        // Update the original message to show it was declined
        try {
          await interaction.message.edit({
            content: '❌ **Invitation Declined**',
            embeds: interaction.message.embeds,
            components: [disabledRow]
          });
        } catch (e) {
          console.log('Could not update original message:', e.message);
        }

        // Notify the team leader
        try {
          const guild = interaction.client.guilds.cache.get(invite.guildId);
          const leader = await guild.members.fetch(team.leader);
          
          const notificationEmbed = new EmbedBuilder()
            .setTitle('❌ Temp Sub Invitation Declined')
            .setDescription(`**${interaction.user.username}** has declined the temporary substitute invitation for **${team.name}**.`)
            .setColor(0xFF0000)
            .setTimestamp();

          await leader.send({ embeds: [notificationEmbed] });
        } catch (e) {
          console.log('Could not notify team leader:', e.message);
        }
      }

    } catch (error) {
      console.error('Error handling temp sub invitation:', error);
      await interaction.editReply({
        content: '❌ An error occurred while processing your response.'
      });
    }
  }
};
