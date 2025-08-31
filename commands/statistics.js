
const Team = require('../database/models/Team');
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statistics')
    .setDescription('View team statistics - your own team by default, specify team name (moderator only)')
    .addStringOption(option =>
      option.setName('teamname')
        .setDescription('The name of the team to look up (Moderator permission required)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check if interaction is still valid
      if (!interaction.isRepliable()) {
        console.log('Statistics interaction is no longer repliable');
        return;
      }

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;
      const requestedTeamName = interaction.options.getString('teamname');

      await interaction.deferReply({ flags: 64 });

      let team;

      if (requestedTeamName) {
        // User wants to view another team's stats - check moderator permissions
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          return await interaction.editReply({
            content: '❌ You need Moderator permissions to view other teams\' statistics. Use `/statistics` without a team name to view your own team.',
          });
        }

        // Look up specific team by name
        team = await Team.findOne({ name: requestedTeamName, guildId: guildId });
        
        if (!team) {
          return await interaction.editReply({
            content: `❌ Team "${requestedTeamName}" not found.`
          });
        }
      } else {
        // User wants to view their own team's stats
        // Check if user is a team leader
        team = await Team.findOne({
          leader: userId,
          guildId: guildId
        });

        // If not a leader, check if they're a team member
        if (!team) {
          team = await Team.findOne({
            'members.userId': userId,
            guildId: guildId
          });
        }

        if (!team) {
          return await interaction.editReply({
            content: '❌ You are not part of any team. Join or create a team first to view statistics.'
          });
        }
      }

      // Get statistics from TeamStats model
      const TeamStats = require('../database/models/TeamStats');
      const teamStats = await TeamStats.findOne({ teamName: team.name, guildId: guildId });
      
      const matchesWon = teamStats?.gamesWon || 0;
      const matchesLost = teamStats?.gamesLost || 0;
      const scrimsWon = teamStats?.wins || 0;
      const scrimsLost = teamStats?.losses || 0;
      const scrimsDrawn = teamStats?.draws || 0;
      const totalScrims = teamStats?.totalScrims || 0;
      
      const matchesPlayed = matchesWon + matchesLost;
      const scrimsPlayed = scrimsWon + scrimsLost + scrimsDrawn;
      const scrimWinRate = scrimsPlayed > 0 ? ((scrimsWon / scrimsPlayed) * 100).toFixed(2) : 0;
      const matchWinRate = matchesPlayed > 0 ? ((matchesWon / matchesPlayed) * 100).toFixed(2) : 0;

      const statsEmbed = new EmbedBuilder()
        .setTitle(`📈 Team Statistics for ${team.name}`)
        .setColor(0x1E90FF)
        .setThumbnail(team.logoUrl || interaction.guild.iconURL())
        .addFields(
          { name: '🏆 Total Scrims', value: `**${totalScrims}**`, inline: true },
          { name: '✅ Scrims Won', value: `**${scrimsWon}**`, inline: true },
          { name: '❌ Scrims Lost', value: `**${scrimsLost}**`, inline: true },
          { name: '🤝 Scrims Drawn', value: `**${scrimsDrawn}**`, inline: true },
          { name: '📊 Scrim Win Rate', value: `**${scrimWinRate}%**`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true }, // Empty field for alignment
          { name: '⚔️ Games Played', value: `**${matchesPlayed}**`, inline: true },
          { name: '🎯 Games Won', value: `**${matchesWon}**`, inline: true },
          { name: '💔 Games Lost', value: `**${matchesLost}**`, inline: true },
          { name: '📈 Game Win Rate', value: `**${matchWinRate}%**`, inline: true },
          { name: '👥 Team Members', value: `**${team.members.length + 1}** members`, inline: true }, // +1 for leader
          { name: '📅 Team Created', value: `<t:${Math.floor(team.createdAt.getTime() / 1000)}:R>`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Team Leader: ${interaction.client.users.cache.get(team.leader)?.tag || 'Unknown'}` });

      await interaction.editReply({ embeds: [statsEmbed] });

    } catch (error) {
      console.error('Error fetching team history:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while fetching team statistics.',
          flags: 64
        });
      } else {
        try {
          await interaction.editReply({
            content: '❌ An error occurred while fetching team statistics.'
          });
        } catch (editError) {
          console.error('Failed to edit reply:', editError);
        }
      }
    }
  }
};
