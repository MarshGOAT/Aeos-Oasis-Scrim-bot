const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_channel')
    .setDescription('Set the channel for scrim announcements')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to post scrims in')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const channel = interaction.options.getChannel('channel');
      const channelPath = path.join(__dirname, '../data/scrim_channel.json');
      
      // Ensure the data directory exists
      const dataDir = path.join(__dirname, '../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(channelPath, JSON.stringify({ channelId: channel.id }));
      await interaction.reply({ 
        content: `✅ Scrim channel set to <#${channel.id}>`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Error setting scrim channel:', error);
      await interaction.reply({ 
        content: `❌ Error setting scrim channel: ${error.message}`, 
        ephemeral: true 
      });
    }
  }
};
