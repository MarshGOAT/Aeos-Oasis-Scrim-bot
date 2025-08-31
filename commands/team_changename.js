const { SlashCommandBuilder } = require('@discordjs/builders');

// /team changename <newname>
module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_changename')
    .setDescription('Change your team name')
    .addStringOption(option =>
      option.setName('newname')
        .setDescription('New team name')
        .setRequired(true)),
  async execute(interaction) {
    const replyText = 'Team name changed (stub).';
    if (interaction.reply) {
      await interaction.reply({ content: replyText, ephemeral: true });
    } else if (interaction.channel && interaction.channel.send) {
      await interaction.channel.send(replyText);
    }
  }
};
