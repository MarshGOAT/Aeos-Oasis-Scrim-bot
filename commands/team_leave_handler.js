const { EmbedBuilder } = require('discord.js');
const Team = require('../database/models/Team');

module.exports = {
  name: 'team_leave_handler',
  async execute(interaction) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ flags: 64 });
    }

    try {
      const customId = interaction.customId;
      const isConfirm = customId.startsWith('teamLeave_confirm_');
      const teamId = customId.replace('teamLeave_confirm_', '').replace('teamLeave_cancel_', '');

      // Find the team
      const team = await Team.findById(teamId);
      if (!team) {
        return await interaction.editReply({
          content: '❌ Team not found or has already been dissolved.'
        });
      }

      // Verify the user is the team leader
      if (team.leader !== interaction.user.id) {
        return await interaction.editReply({
          content: '❌ Only the team leader can dissolve the team.'
        });
      }

      if (isConfirm) {
        // Check for open scrims before dissolving
        const Scrim = require('../database/models/Scrim');
        const openScrims = await Scrim.find({
          $or: [
            { teamName: team.name, status: { $in: ['open', 'accepted'] } },
            { opposingTeamName: team.name, status: { $in: ['open', 'accepted'] } }
          ],
          guildId: interaction.guildId
        });

        if (openScrims.length > 0) {
          return await interaction.editReply({
            content: `❌ Cannot dissolve team **${team.name}** while there are ${openScrims.length} open scrim(s). Please finish or cancel all scrims first.`
          });
        }

        // Get all team members for notification
        const allMembers = [...team.members];
        const teamName = team.name;
        const roleId = team.roleId;

        // Remove role from all team members before deleting it
        if (roleId) {
          try {
            const role = await interaction.guild.roles.fetch(roleId);
            if (role) {
              // Remove role from leader
              const leader = await interaction.guild.members.fetch(team.leader);
              if (leader && leader.roles.cache.has(roleId)) {
                await leader.roles.remove(role);
              }
              
              // Remove role from all team members
              for (const member of allMembers) {
                try {
                  const guildMember = await interaction.guild.members.fetch(member.userId);
                  if (guildMember && guildMember.roles.cache.has(roleId)) {
                    await guildMember.roles.remove(role);
                  }
                } catch (memberError) {
                  console.error(`Error removing role from ${member.username}:`, memberError);
                  // Continue with other members
                }
              }
              
              // Delete the role after removing it from all members
              await role.delete(`Team ${teamName} dissolved`);
            }
          } catch (roleError) {
            console.error('Error handling team role:', roleError);
            // Continue with team deletion even if role handling fails
          }
        }

        // Delete the team
        await Team.deleteOne({ _id: teamId });

        // Disable buttons
        const disabledRow = interaction.message.components[0];
        disabledRow.components.forEach(button => button.data.disabled = true);

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Team Dissolved')
          .setDescription(`**${teamName}** has been successfully dissolved.\n\nAll ${allMembers.length + 1} members have been removed from the team.\n🎭 Team role has been deleted.`)
          .setColor(0x00FF00)
          .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        // Update the original message to show it was confirmed
        try {
          await interaction.message.edit({
            content: '✅ **Team Dissolved**',
            embeds: interaction.message.embeds,
            components: [disabledRow]
          });
        } catch (e) {
          console.log('Could not update original message:', e.message);
        }

        // Notify all team members
        for (const member of allMembers) {
          try {
            const user = await interaction.client.users.fetch(member.userId);
            
            const notificationEmbed = new EmbedBuilder()
              .setTitle('🗑️ Team Dissolved')
              .setDescription(`**${teamName}** has been dissolved by the team leader.\n\nYou are no longer a member of this team.\n🎭 Team role has been removed.`)
              .setColor(0xFF6B6B)
              .setTimestamp();

            await user.send({ embeds: [notificationEmbed] });
          } catch (e) {
            console.log(`Could not notify member ${member.username}:`, e.message);
          }
        }

      } else {
        // Cancel
        // Disable buttons
        const disabledRow = interaction.message.components[0];
        disabledRow.components.forEach(button => button.data.disabled = true);

        await interaction.editReply({
          content: `❌ Team dissolution cancelled. **${team.name}** remains intact.`
        });

        // Update the original message to show it was cancelled
        try {
          await interaction.message.edit({
            content: '❌ **Dissolution Cancelled**',
            embeds: interaction.message.embeds,
            components: [disabledRow]
          });
        } catch (e) {
          console.log('Could not update original message:', e.message);
        }
      }

    } catch (error) {
      console.error('Error handling team leave confirmation:', error);
      await interaction.editReply({
        content: '❌ An error occurred while processing your response.'
      });
    }
  }
};
