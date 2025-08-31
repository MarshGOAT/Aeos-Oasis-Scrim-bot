const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const Team = require('../database/models/Team');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_info')
    .setDescription('Show team info')
    .addStringOption(option =>
      option.setName('teamname')
        .setDescription('Team name to show info for (optional - shows your team if not specified)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;
      const teamName = interaction.options.getString('teamname');

      let team;

      if (teamName) {
        // Look up specific team by name
        team = await Team.findOne({ 
          name: teamName, 
          guildId: guildId 
        });
        
        if (!team) {
          return await interaction.reply({
            content: `❌ Team **${teamName}** not found.`,
            ephemeral: true
          });
        }
      } else {
        // Look up user's own team
        team = await Team.findOne({
          $or: [
            { leader: userId },
            { 'members.userId': userId }
          ],
          guildId: guildId
        });

        if (!team) {
          return await interaction.reply({
            content: '❌ You are not in any team. Create or join a team first.',
            ephemeral: true
          });
        }
      }

      // Get leader info from guild
      let leaderName = 'Unknown';
      try {
        const leaderMember = await interaction.guild.members.fetch(team.leader);
        leaderName = leaderMember.user.username;
      } catch (e) {
        console.log('Could not fetch leader info:', e.message);
      }

      // Create member list (excluding temp subs and leader)
      const regularMembers = team.members || [];
      const nonLeaderMembers = regularMembers.filter(member => member.userId !== team.leader);
      
      const memberList = nonLeaderMembers.length > 0 ? 
        nonLeaderMembers
          .map(member => {
            const joinDate = new Date(member.joinedAt).toLocaleDateString();
            return `👤 **${member.username}** - Joined: ${joinDate}`;
          })
          .join('\n') : '';
      
      // Add leader to the display
      const fullMemberList = `👑 **${leaderName}** (Leader)${memberList ? '\n' + memberList : ''}`;

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Team: ${team.name}`)
        .setColor(0x00AE86)
        .addFields(
          { name: '👑 Leader', value: leaderName, inline: true },
          { name: '👥 Members', value: `${nonLeaderMembers.length + 1}/6`, inline: true },
          { name: '📅 Created', value: new Date(team.createdAt).toLocaleDateString(), inline: true },
          { name: '📋 Team Roster', value: fullMemberList, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Team Information' });

      await interaction.reply({ embeds: [embed], ephemeral: false });

    } catch (error) {
      console.error('Error showing team info:', error);
      await interaction.reply({
        content: '❌ An error occurred while retrieving team information. Please try again.',
        ephemeral: true
      });
    }
  }
};
