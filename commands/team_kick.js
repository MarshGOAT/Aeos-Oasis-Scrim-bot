const { SlashCommandBuilder } = require('@discordjs/builders');
const Team = require('../database/models/Team');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_kick')
    .setDescription('Kick a user from your team')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to kick')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Check if the kicker is a team leader
      const team = await Team.findOne({
        leader: userId,
        guildId: guildId
      });

      if (!team) {
        return await interaction.reply({
          content: '❌ You must be a team leader to kick members. Create a team first.',
          ephemeral: true
        });
      }

      // Check if user is trying to kick themselves (leader)
      if (targetUser.id === userId) {
        return await interaction.reply({
          content: '❌ You cannot kick yourself. Use `/team_disband` to disband the team instead.',
          ephemeral: true
        });
      }

      // Check if target user is in the team
      const memberIndex = team.members.findIndex(member => member.userId === targetUser.id);
      
      if (memberIndex === -1) {
        return await interaction.reply({
          content: `❌ ${targetUser.username} is not in your team.`,
          ephemeral: true
        });
      }

      // Remove the member from the team
      team.members.splice(memberIndex, 1);
      await team.save();

      // Remove team role from kicked member
      if (team.roleId) {
        try {
          const role = await interaction.guild.roles.fetch(team.roleId);
          const member = await interaction.guild.members.fetch(targetUser.id);
          if (role && member) {
            await member.roles.remove(role);
          }
        } catch (roleError) {
          console.error('Error removing team role:', roleError);
          // Continue even if role removal fails
        }
      }

      await interaction.reply({
        content: `✅ ${targetUser.username} has been kicked from team **${team.name}**.\n🎭 Team role has been removed.`,
        ephemeral: false
      });

      // Try to DM the kicked user
      try {
        await targetUser.send(`😔 You've been removed from team **${team.name}** in ${interaction.guild.name}.`);
      } catch (error) {
        // User has DMs disabled, that's okay
        console.log(`Could not DM user ${targetUser.username}`);
      }

    } catch (error) {
      console.error('Error kicking user from team:', error);
      
      // Only reply if we haven't already replied
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: '❌ An error occurred while kicking the user. Please try again.',
            ephemeral: true
          });
        } catch (replyError) {
          console.error('Failed to send error reply:', replyError);
        }
      }
    }
  }
};
