const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// Paginated help command with interactive UI
const commandsList = [
  {
    title: '🏆 Team Management Commands',
    commands: [
      '`/team create <name>` - Create a new team with you as leader',
      '`/team invite @user` - Send team invitation to a user',
      '`/team kick @user` - Remove a member from your team (leader only)',
      '`/team changename <newname>` - Change your team name (leader only)',
      '`/team changeleader @user` - Transfer leadership to another member',
      '`/team disband` - Permanently delete your team (leader only)',
      '`/team leave` - Leave your current team',
      '`/team info [teamname]` - View team information and roster'
    ]
  },
  {
    title: '⚔️ Scrim Commands',
    commands: [
      '`/scrim create` - Create a new scrim challenge',
      '`/scrim accept <scrim_id>` - Accept an open scrim challenge',
      '`/scrim cancel <scrim_id>` - Cancel your scrim (creator only)',
      '`/scrim finish <scrim_id>` - Record scrim results and finish',
      '`/scrim list` - View all open scrim challenges',
      '`/temp sub @user <scrim_id>` - Invite temporary substitute for scrim',
      '`/calendar` - View your team\'s upcoming scrims'
    ]
  },
  {
    title: '📊 Statistics & Utility',
    commands: [
      '`/statistics` - View team statistics and match history',
      '`/help` - Show this help menu'
    ]
  },
  {
    title: '🛡️ Moderator Commands',
    commands: [
      '`/scrim_clear [status]` - Clear scrims and delete channels',
      '`/verifyteam <teamname>` - Verify a team',
      '`/set verified role @role` - Set verified role',
      '`/scrim_channel` - Set dedicated scrim channel',
      'Moderators can cancel any scrim using the cancel button'
    ]
  }
];

function getHelpEmbed(page) {
  const section = commandsList[page];
  return new EmbedBuilder()
    .setTitle(section.title)
    .setDescription(section.commands.join('\n'))
    .setColor(0x00AE86)
    .setFooter({ text: `Page ${page + 1} of ${commandsList.length} • Use buttons to navigate` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands'),
  async execute(interaction) {
    let page = 0;
    const embed = getHelpEmbed(page);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(commandsList.length === 1)
    );
    const reply = await interaction.reply({ embeds: [embed], components: [row] });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.customId === 'next') page++;
      if (i.customId === 'prev') page--;
      const embed = getHelpEmbed(page);
      row.components[0].setDisabled(page === 0);
      row.components[1].setDisabled(page === commandsList.length - 1);
      await i.update({ embeds: [embed], components: [row] });
    });
  }
};
