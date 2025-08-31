const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_changeleader')
    .setDescription('Change team leader')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('New team leader')
        .setRequired(true)),
  async execute(interaction) {
    const replyText = 'Team leader changed (stub).';
    if (interaction.reply) {
      await interaction.reply({ content: replyText, ephemeral: true });
    } else if (interaction.channel && interaction.channel.send) {
      await interaction.channel.send(replyText);
    }
  }
};
