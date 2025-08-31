const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Team = require('../database/models/Team');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_leave')
    .setDescription('Leave your current team'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Find the team the user is in
      const team = await Team.findOne({
        guildId: guildId,
        $or: [
          { leader: userId },
          { 'members.userId': userId }
        ]
      });

      if (!team) {
        return await interaction.editReply({
          content: '❌ You are not a member of any team.'
        });
      }

      const isLeader = team.leader === userId;
      const memberCount = team.members.length + 1; // +1 for leader

      // If user is the leader and there are other members
      if (isLeader && team.members.length > 0) {
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Confirm Team Dissolution')
          .setDescription(`You are the leader of **${team.name}**.\n\n` +
                         `Leaving will **dissolve the entire team** and remove all ${memberCount} members.\n\n` +
                         `**Team Members:**\n` +
                         `• ${interaction.user.username} (Leader)\n` +
                         team.members.map(member => `• ${member.username}`).join('\n') +
                         `\n\nAre you sure you want to dissolve the team?`)
          .setColor(0xFF6B6B)
          .setTimestamp();

        const confirmButton = new ButtonBuilder()
          .setCustomId(`teamLeave_confirm_${team._id}`)
          .setLabel('🗑️ Dissolve Team')
          .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
          .setCustomId(`teamLeave_cancel_${team._id}`)
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        return await interaction.editReply({
          embeds: [confirmEmbed],
          components: [row]
        });
      }

      // If user is a regular member or leader with no other members
      if (isLeader) {
        // Leader leaving empty team - delete team and role
        const teamName = team.name;
        const roleId = team.roleId;
        
        // Remove role from leader and delete it
        if (roleId) {
          try {
            const role = await interaction.guild.roles.fetch(roleId);
            if (role) {
              // Remove role from leader
              const member = await interaction.guild.members.fetch(userId);
              if (member && member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
              }
              // Delete the role
              await role.delete(`Team ${teamName} dissolved`);
            }
          } catch (roleError) {
            console.error('Error handling team role:', roleError);
            // Continue with team deletion even if role handling fails
          }
        }
        
        await Team.deleteOne({ _id: team._id });

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Team Dissolved')
          .setDescription(`You have successfully dissolved **${teamName}**.\n🎭 Team role has been deleted.`)
          .setColor(0x00FF00)
          .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });
      } else {
        // Regular member leaving
        team.members = team.members.filter(member => member.userId !== userId);
        await team.save();

        // Remove team role from leaving member
        if (team.roleId) {
          try {
            const role = await interaction.guild.roles.fetch(team.roleId);
            const member = await interaction.guild.members.fetch(userId);
            if (role && member) {
              await member.roles.remove(role);
            }
          } catch (roleError) {
            console.error('Error removing team role:', roleError);
            // Continue even if role removal fails
          }
        }

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Left Team')
          .setDescription(`You have successfully left **${team.name}**.\n🎭 Team role has been removed.`)
          .setColor(0x00FF00)
          .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        // Notify team leader
        try {
          const leader = await interaction.guild.members.fetch(team.leader);
          
          const notificationEmbed = new EmbedBuilder()
            .setTitle('👋 Member Left Team')
            .setDescription(`**${interaction.user.username}** has left **${team.name}**.`)
            .setColor(0xFFA500)
            .setTimestamp();

          await leader.send({ embeds: [notificationEmbed] });
        } catch (e) {
          console.log('Could not notify team leader:', e.message);
        }
      }

    } catch (error) {
      console.error('Error leaving team:', error);
      await interaction.editReply({
        content: '❌ An error occurred while trying to leave the team.'
      });
    }
  }
};
