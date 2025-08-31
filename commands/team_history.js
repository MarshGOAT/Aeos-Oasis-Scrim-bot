const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Team = require('../database/models/Team');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_history')
    .setDescription('View detailed team history and match records'),
  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      await interaction.deferReply({ ephemeral: true });

      // Find user's team
      let team = await Team.findOne({
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
          content: '❌ You are not part of any team. Join or create a team first to view team history.'
        });
      }

      // Correct field mapping: matches = individual games, scrims = overall series
      const matchesWon = team.matchesWon || 0;
      const matchesLost = team.matchesLost || 0;
      const scrimsWon = team.scrimsWon || 0;
      const scrimsLost = team.scrimsLost || 0;
      
      const matchesPlayed = matchesWon + matchesLost;
      const scrimsPlayed = scrimsWon + scrimsLost;
      const scrimWinRate = scrimsPlayed > 0 ? ((scrimsWon / scrimsPlayed) * 100).toFixed(2) : 0;

      const historyEmbed = new EmbedBuilder()
        .setTitle(`📜 Team History for ${team.name}`)
        .setColor(0x9932CC)
        .setThumbnail(team.logoUrl || interaction.guild.iconURL())
        .setDescription(`Detailed history and performance records for **${team.name}**`)
        .addFields(
          { name: '⚔️ Games Played', value: `**${matchesPlayed}**`, inline: true },
          { name: '✅ Games Won', value: `**${matchesWon}**`, inline: true },
          { name: '❌ Games Lost', value: `**${matchesLost}**`, inline: true },
          { name: '🏆 Series Played', value: `**${scrimsPlayed}**`, inline: true },
          { name: '🎯 Series Won', value: `**${scrimsWon}**`, inline: true },
          { name: '💔 Series Lost', value: `**${scrimsLost}**`, inline: true },
          { name: '📊 Win/Loss Score', value: `**${matchesWon}-${matchesLost}**`, inline: true },
          { name: '📈 Win Rate', value: `**${scrimWinRate}%**`, inline: true },
          { name: '👥 Active Members', value: `**${team.members.length}**`, inline: true }
        )
        .setTimestamp()
        .setFooter({ 
          text: `Team ID: ${team._id.toString().slice(-8)}`,
          iconURL: interaction.guild.iconURL()
        });

      await interaction.editReply({ embeds: [historyEmbed] });

    } catch (error) {
      console.error('Error fetching team history:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching team history.'
      });
    }
  }
};
