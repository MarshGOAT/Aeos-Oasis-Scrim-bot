// Team management commands
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Team management commands'),
  
  async execute(interaction) {
    await interaction.reply({ 
      content: 'Please use one of the specific team commands:\n' +
               '`/team_create` - Create a new team\n' +
               '`/team_invite` - Invite a player to your team\n' +
               '`/team_kick` - Remove a player from your team\n' +
               '`/team_leave` - Leave your current team\n' +
               '`/team_info` - View team information\n' +
               '`/team_changename` - Change your team name\n' +
               '`/team_changeleader` - Transfer team leadership\n' +
               '`/team_disband` - Disband your team\n' +
               '`/team_history` - View team match history',
      ephemeral: true 
    });
  }
};
