const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const Scrim = require('../database/models/Scrim');

// /scrim list
module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_list')
    .setDescription('List open scrims'),
  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;

      // Find all open scrims in this guild
      const scrims = await Scrim.find({ 
        guildId: guildId,
        status: 'open'
      }).sort({ createdAt: -1 });

      if (scrims.length === 0) {
        return await interaction.reply({
          content: '📋 No open scrims found.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 Open Scrims')
        .setColor(0x00AE86)
        .setTimestamp()
        .setFooter({ text: `${scrims.length} open scrim(s)` });

      // Function to calculate relative time
      function getRelativeTime(date) {
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffTime / (1000 * 60));

        if (diffDays > 0) {
          return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        } else if (diffHours > 0) {
          return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        } else if (diffMinutes > 0) {
          return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        } else {
          return 'Just now';
        }
      }

      let description = '';
      scrims.forEach((scrim, index) => {
        const relativeTime = getRelativeTime(new Date(scrim.createdAt));
        description += `**${index + 1}. ID: ${scrim.scrimId}**\n`;
        description += `🏆 Team: **${scrim.teamName}**\n`;
        description += `📅 Date: ${scrim.date}\n`;
        description += `⏰ Time: ${scrim.time}\n`;
        description += `🎮 Games: ${scrim.games}\n`;
        if (scrim.otherInfo) {
          description += `📝 Info: ${scrim.otherInfo}\n`;
        }
        description += `📆 Posted: ${relativeTime}\n\n`;
      });

      embed.setDescription(description);

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error listing scrims:', error);
      await interaction.reply({
        content: `❌ An error occurred while listing scrims: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
