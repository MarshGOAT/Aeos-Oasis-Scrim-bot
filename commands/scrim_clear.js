const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Scrim = require('../database/models/Scrim');
const Team = require('../database/models/Team');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_clear')
    .setDescription('Clear all scrims (Moderator only)')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Status of scrims to clear')
        .setRequired(false)
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Open only', value: 'open' },
          { name: 'Accepted only', value: 'accepted' },
          { name: 'Finished only', value: 'finished' },
          { name: 'Cancelled only', value: 'cancelled' }
        )
    ),
  
  async execute(interaction) {
    try {
      // Check if user has Administrator permissions
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
          content: '❌ You need Administrator permissions to use this command.',
          ephemeral: true
        });
      }

      const statusFilter = interaction.options.getString('status') || 'all';
      
      // Build query based on status filter
      let query = { guildId: interaction.guild.id };
      if (statusFilter !== 'all') {
        query.status = statusFilter;
      }

      // Get count of scrims to be deleted
      const scrimCount = await Scrim.countDocuments(query);
      
      if (scrimCount === 0) {
        const statusText = statusFilter === 'all' ? 'scrims' : `${statusFilter} scrims`;
        return await interaction.reply({
          content: `❌ No ${statusText} found to clear.`,
          ephemeral: true
        });
      }

      // Create warning message based on what's being cleared
      let warningMessage = '';
      if (statusFilter === 'all') {
        warningMessage = '⚠️ **WARNING: THIS WILL CLEAR ALL SCRIMS FROM THE DATABASE!**';
      } else {
        warningMessage = `⚠️ **WARNING: THIS WILL CLEAR ALL ${statusFilter.toUpperCase()} SCRIMS FROM THE DATABASE!**`;
      }

      // Show warning with scrim count and confirmation buttons
      const warningEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirmation Required')
        .setDescription(`${warningMessage}\n\n**${scrimCount}** ${statusFilter === 'all' ? 'scrims' : `${statusFilter} scrims`} will be permanently deleted.\n\n**This action cannot be undone!**\n\n**All active scrim channels will also be deleted.**`)
        .setColor(0xFF4444)
        .setTimestamp();

      // Create confirmation buttons
      const confirmRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`clear_confirm_${statusFilter}`)
            .setLabel('✅ Confirm Clear')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`clear_cancel_${statusFilter}`)
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({
        embeds: [warningEmbed],
        components: [confirmRow],
        ephemeral: true
      });

      // Log the action (no deletion happens here, just showing the warning)
      console.log(`${interaction.user.tag} initiated clear for ${statusFilter} scrims in guild ${interaction.guild.name}`);

    } catch (error) {
      console.error('Error clearing scrims:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `❌ Error clearing scrims: ${error.message}`,
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: `❌ Error clearing scrims: ${error.message}`,
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('Failed to send error reply for scrim_clear:', replyError);
      }
    }
  }
};
