const { SlashCommandBuilder } = require('@discordjs/builders');
const Team = require('../database/models/Team');

// /team disband
module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_disband')
    .setDescription('Disband your team'),
  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Check if the user is a team leader
      const team = await Team.findOne({
        leader: userId,
        guildId: guildId
      });

      if (!team) {
        return await interaction.reply({
          content: '❌ You must be a team leader to disband a team. You don\'t have a team to disband.',
          ephemeral: true
        });
      }

      // Check for open scrims before disbanding
      const Scrim = require('../database/models/Scrim');
      const openScrims = await Scrim.find({
        $or: [
          { teamName: team.name, status: { $in: ['open', 'accepted'] } },
          { opposingTeamName: team.name, status: { $in: ['open', 'accepted'] } }
        ],
        guildId: guildId
      });

      if (openScrims.length > 0) {
        return await interaction.reply({
          content: `❌ Cannot disband team **${team.name}** while there are ${openScrims.length} open scrim(s). Please finish or cancel all scrims first.`,
          ephemeral: true
        });
      }

      const teamName = team.name;
      const memberCount = team.members.length;
      const roleId = team.roleId;

      // Remove role from all team members before deleting it
      if (roleId) {
        try {
          const role = await interaction.guild.roles.fetch(roleId);
          if (role) {
            // Remove role from all team members
            for (const member of team.members) {
              try {
                const guildMember = await interaction.guild.members.fetch(member.userId);
                if (guildMember && guildMember.roles.cache.has(roleId)) {
                  await guildMember.roles.remove(role);
                  console.log(`Removed role from ${member.username}`);
                }
              } catch (memberError) {
                console.error(`Error removing role from ${member.username}:`, memberError);
                // Continue with other members
              }
            }
            
            // Delete the role after removing it from all members
            await role.delete(`Team ${teamName} disbanded`);
          }
        } catch (roleError) {
          console.error('Error handling team role:', roleError);
          // Continue with team deletion even if role handling fails
        }
      }

      // Delete the team from database
      await Team.deleteOne({ _id: team._id });

      await interaction.reply({
        content: `✅ Team **${teamName}** has been disbanded. All ${memberCount} members have been removed.\n🎭 Team role has been deleted.`,
        ephemeral: true
      });

      // Try to DM all team members about the disbandment
      for (const member of team.members) {
        if (member.userId !== userId) { // Don't DM the leader who disbanded
          try {
            const user = await interaction.client.users.fetch(member.userId);
            await user.send(`📢 Team **${teamName}** in ${interaction.guild.name} has been disbanded by the team leader.`);
          } catch (error) {
            // User has DMs disabled or other error, that's okay
            console.log(`Could not DM user ${member.username}`);
          }
        }
      }

    } catch (error) {
      console.error('Error disbanding team:', error);
      console.error('Full error details:', error.stack);
      
      // Check if it's a database connection error
      if (error.name === 'MongoNetworkError' || error.name === 'MongooseError') {
        await interaction.reply({
          content: '❌ Database connection error. Please check the database connection and try again.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `❌ An error occurred while disbanding the team: ${error.message}. Please try again.`,
          ephemeral: true
        });
      }
    }
  }
};
