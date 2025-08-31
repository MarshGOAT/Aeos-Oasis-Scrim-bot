const { EmbedBuilder } = require('discord.js');
const Team = require('../database/models/Team');

module.exports = {
  name: 'team_invite_handler',
  async execute(interaction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    
    if (customId.startsWith('teamInviteAccept_') || customId.startsWith('teamInviteDecline_')) {
      const inviteId = customId.replace('teamInviteAccept_', '').replace('teamInviteDecline_', '');
      const isAccepting = customId.startsWith('teamInviteAccept_');
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ flags: 64 });
        }
      } catch (error) {
        console.log('Failed to defer reply:', error);
        return;
      }
      
      console.log(`Looking for invite ID: ${inviteId}`);
      
      // Find the team with this pending invite
      const team = await Team.findOne({
        pendingInvites: { $elemMatch: { inviteId: inviteId } }
      });
      
      console.log(`Found team:`, team ? `${team.name} with ${team.pendingInvites?.length || 0} pending invites` : 'null');
      
      if (!team) {
        return await interaction.editReply({
          content: '❌ This invite has expired or is no longer valid.'
        });
      }
      
      // Find the specific invite
      const invite = team.pendingInvites.find(inv => inv.inviteId === inviteId);
      
      console.log(`Found invite:`, invite ? `for user ${invite.userId}` : 'null');
      
      if (!invite) {
        return await interaction.editReply({
          content: '❌ This invite has expired or is no longer valid.'
        });
      }
      
      // Check if the user clicking is the invited user
      if (interaction.user.id !== invite.userId) {
        return await interaction.editReply({
          content: '❌ This invite is not for you.'
        });
      }
      
      if (isAccepting) {
        // Check if user is already in any team
        const existingTeam = await Team.findOne({
          $or: [
            { leader: interaction.user.id },
            { 'members.userId': interaction.user.id }
          ],
          guildId: invite.guildId
        });
        
        if (existingTeam) {
          // Remove the pending invite
          team.pendingInvites = team.pendingInvites.filter(inv => inv.inviteId !== inviteId);
          await team.save();
          
          return await interaction.editReply({
            content: `❌ You are already in team **${existingTeam.name}**. Leave your current team first.`
          });
        }
        
        // Check team size limit
        if (team.members.length >= 6) {
          // Remove the pending invite
          team.pendingInvites = team.pendingInvites.filter(inv => inv.inviteId !== inviteId);
          await team.save();
          
          return await interaction.editReply({
            content: '❌ This team is now full (maximum 6 members).'
          });
        }
        
        // Add user to team
        team.members.push({
          userId: interaction.user.id,
          username: interaction.user.username,
          joinedAt: new Date()
        });
        
        // Remove the pending invite
        team.pendingInvites = team.pendingInvites.filter(inv => inv.inviteId !== inviteId);
        await team.save();
        
        // Try to get the guild and assign team role
        try {
          const guild = interaction.client.guilds.cache.get(invite.guildId);
          if (guild && team.roleId) {
            const role = await guild.roles.fetch(team.roleId);
            const member = await guild.members.fetch(interaction.user.id);
            if (role && member) {
              await member.roles.add(role);
            }
          }
        } catch (roleError) {
          console.error('Error assigning team role:', roleError);
        }

        // Add user to existing scrim channels
        try {
          const guild = interaction.client.guilds.cache.get(invite.guildId);
          if (guild) {
            const Scrim = require('../database/models/Scrim');
            const activeScrimChannels = await Scrim.find({
              $or: [
                { teamName: team.name, status: 'accepted' },
                { opposingTeamName: team.name, status: 'accepted' }
              ],
              guildId: invite.guildId,
              channelId: { $exists: true, $ne: null }
            });

            for (const scrim of activeScrimChannels) {
              try {
                const channel = guild.channels.cache.get(scrim.channelId);
                if (channel) {
                  await channel.permissionOverwrites.create(interaction.user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                  });
                  console.log(`Added ${interaction.user.username} to scrim channel ${channel.name}`);
                }
              } catch (channelError) {
                console.error(`Error adding user to scrim channel:`, channelError);
              }
            }
          }
        } catch (scrimChannelError) {
          console.error('Error adding user to scrim channels:', scrimChannelError);
        }
        
        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Team Invite Accepted!')
          .setDescription(`You have successfully joined team **${team.name}**!\n\n` +
                         `🎭 Team role has been assigned.\n` +
                         `Welcome to the team!`)
          .setColor(0x00FF00)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [successEmbed] });
        
        // Try to notify the team leader
        try {
          const guild = interaction.client.guilds.cache.get(invite.guildId);
          if (guild) {
            const leader = await guild.members.fetch(invite.invitedBy);
            if (leader) {
              await leader.send(`✅ ${interaction.user.username} has accepted the invite to join team **${team.name}**!`);
            }
          }
        } catch (error) {
          console.log('Could not notify team leader:', error);
        }
        
      } else {
        // Declining the invite
        team.pendingInvites = team.pendingInvites.filter(inv => inv.inviteId !== inviteId);
        await team.save();
        
        const declineEmbed = new EmbedBuilder()
          .setTitle('❌ Team Invite Declined')
          .setDescription(`You have declined the invitation to join team **${team.name}**.`)
          .setColor(0xFF4444)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [declineEmbed] });
        
        // Try to notify the team leader
        try {
          const guild = interaction.client.guilds.cache.get(invite.guildId);
          if (guild) {
            const leader = await guild.members.fetch(invite.invitedBy);
            if (leader) {
              await leader.send(`❌ ${interaction.user.username} has declined the invite to join team **${team.name}**.`);
            }
          }
        } catch (error) {
          console.log('Could not notify team leader:', error);
        }
      }
      
      // Disable the buttons in the original message
      try {
        await interaction.message.edit({ components: [] });
      } catch (error) {
        console.log('Could not disable buttons:', error);
      }
    }
  }
};
