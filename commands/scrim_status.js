
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Scrim = require('../database/models/Scrim');
const Team = require('../database/models/Team');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_status')
    .setDescription('Check the status of a scrim')
    .addStringOption(option =>
      option.setName('scrim_id')
        .setDescription('The 6-digit scrim ID')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(6))
    .addBooleanOption(option =>
      option.setName('reset')
        .setDescription('Reset the scrim status to "accepted" (Admin only)')
        .setRequired(false)),
  
  async execute(interaction) {
    try {
      const scrimId = interaction.options.getString('scrim_id');
      const resetStatus = interaction.options.getBoolean('reset') || false;
      
      // Find the scrim
      const scrim = await Scrim.findOne({ 
        scrimId: scrimId,
        guildId: interaction.guild.id
      });
      
      if (!scrim) {
        return await interaction.reply({
          content: `❌ Could not find scrim with ID **${scrimId}**.`,
          ephemeral: true
        });
      }
      
      // Check if user is trying to reset and has admin permissions
      if (resetStatus) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await interaction.reply({
            content: `❌ You need Administrator permissions to reset a scrim's status.`,
            ephemeral: true
          });
        }
        
        // Reset the scrim status
        const oldStatus = scrim.status;
        scrim.status = 'accepted';
        scrim.pendingConfirmation = false;
        await scrim.save();
        
        return await interaction.reply({
          content: `✅ Successfully reset scrim **${scrimId}** from status "${oldStatus}" to "accepted".`,
          ephemeral: true
        });
      }
      
      // Create an embed with detailed scrim information
      const embed = new EmbedBuilder()
        .setTitle(`Scrim Status: ${scrimId}`)
        .setDescription(`Detailed information about scrim **${scrimId}**`)
        .addFields(
          { name: 'Status', value: scrim.status, inline: true },
          { name: 'Pending Confirmation', value: scrim.pendingConfirmation ? 'Yes' : 'No', inline: true },
          { name: 'Teams', value: `${scrim.teamName} vs ${scrim.opposingTeamName || 'Not accepted yet'}`, inline: false },
          { name: 'Created At', value: `<t:${Math.floor(new Date(scrim.createdAt).getTime() / 1000)}:F>`, inline: true },
          { name: 'Scheduled For', value: `${scrim.date} at ${scrim.time}`, inline: true }
        )
        .setColor(getStatusColor(scrim.status))
        .setTimestamp();
      
      // Add finished info if applicable
      if (scrim.status === 'finished' && scrim.finishedAt) {
        embed.addFields(
          { name: 'Finished At', value: `<t:${Math.floor(new Date(scrim.finishedAt).getTime() / 1000)}:F>`, inline: true },
          { name: 'Results', value: `Wins: ${scrim.wins || 0}, Losses: ${scrim.losses || 0}`, inline: true }
        );
      }
      
      // Add channel info if available
      if (scrim.channelId) {
        const channel = interaction.guild.channels.cache.get(scrim.channelId);
        embed.addFields({
          name: 'Channel',
          value: channel ? `${channel} (ID: ${channel.id})` : `Not found (ID: ${scrim.channelId})`,
          inline: false
        });
      }
      
      // Add admin note if user has admin permissions
      if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        embed.addFields({
          name: 'Admin Options',
          value: `Use \`/scrim_status ${scrimId} reset:True\` to reset this scrim to "accepted" status.\n` +
                 `Use \`/scrim_delete_channel ${scrimId}\` to force delete the channel.`,
          inline: false
        });
      }
      
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error in scrim_status:', error);
      await interaction.reply({
        content: `❌ An error occurred: ${error.message}`,
        ephemeral: true
      });
    }
  }
};

// Helper function to get color based on status
function getStatusColor(status) {
  switch (status) {
    case 'open': return 0x3498DB; // Blue
    case 'accepted': return 0xF1C40F; // Yellow
    case 'finished': return 0x2ECC71; // Green
    case 'cancelled': return 0xE74C3C; // Red
    default: return 0x95A5A6; // Gray
  }
}
