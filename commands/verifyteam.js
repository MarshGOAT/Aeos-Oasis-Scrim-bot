// Mod-only command to verify a team
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const Team = require('../database/models/Team');
const path = require('path');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verifyteam')
    .setDescription('Verify a team, giving them a special role (Admin only)')
    .addStringOption(option =>
      option.setName('teamname')
        .setDescription('The name of the team to verify')
        .setRequired(true)),
  async execute(interaction) {
    try {
      // Check for Administrator permissions
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
          content: '❌ You must have Administrator permissions to use this command.',
          ephemeral: true
        });
      }

      const teamName = interaction.options.getString('teamname');
      const guildId = interaction.guild.id;

      // Find the team in the database
      const team = await Team.findOne({ name: teamName, guildId: guildId });

      if (!team) {
        return await interaction.reply({
          content: `❌ Team "${teamName}" not found.`,
          ephemeral: true
        });
      }

      // Get the verified role from config
      let verifiedRoleId = null;
      try {
        const roleData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/verified_role.json'), 'utf8'));
        verifiedRoleId = roleData.roleId;
      } catch (e) {
        return await interaction.reply({
          content: '❌ Verified role not set up. Use `/set_verified_role` first.',
          ephemeral: true
        });
      }

      const verifiedRole = interaction.guild.roles.cache.get(verifiedRoleId);
      if (!verifiedRole) {
        return await interaction.reply({
          content: '❌ The verified role configured for this server no longer exists.',
          ephemeral: true
        });
      }

      // Get all members of the team (leader + members)
      const allMemberIds = [team.leader, ...team.members.map(m => m.userId)];
      const membersToUpdate = [];

      for (const memberId of allMemberIds) {
        try {
          const member = await interaction.guild.members.fetch(memberId);
          if (member && !member.roles.cache.has(verifiedRoleId)) {
            await member.roles.add(verifiedRole);
            membersToUpdate.push(member.user.tag);
          }
        } catch (error) {
          console.error(`Could not find or update member with ID ${memberId}:`, error);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Team Verified!')
        .setDescription(`**${team.name}** has been successfully verified.`)
        .setColor(0x00FF00)
        .addFields({
          name: 'Members Given Verified Role',
          value: membersToUpdate.length > 0 ? membersToUpdate.join('\n') : 'All members already had the role.'
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error verifying team:', error);
      await interaction.reply({
        content: `❌ An error occurred: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
