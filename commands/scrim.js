// Scrim system commands
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim')
    .setDescription('Scrim system: create, accept, cancel, list, history'),
  
  async execute(interaction) {
    await interaction.reply({ 
      content: 'Please use one of the specific scrim commands:\n' +
               '`/scrim_create` - Create a new scrim\n' +
               '`/scrim_accept` - Accept an open scrim\n' +
               '`/scrim_cancel` - Cancel a scrim\n' +
               '`/scrim_list` - List available scrims\n' +
               '`/scrim_status` - Check scrim status\n' +
               '`/scrim_finish` - Finish a scrim',
      ephemeral: true 
    });
  }
};
