const { EmbedBuilder } = require('discord.js');
const Scrim = require('../database/models/Scrim');
const Team = require('../database/models/Team');

module.exports = {
  name: 'scrim_clear_handler',
  async execute(interaction) {
    try {
      const customId = interaction.customId;
      
      if (customId.startsWith('clear_confirm_')) {
        const statusFilter = customId.replace('clear_confirm_', '');
        
        // Build query based on status filter
        let query = { guildId: interaction.guild.id };
        if (statusFilter !== 'all') {
          query.status = statusFilter;
        }

        // Get scrims to find their channels and messages before deletion
        const scrimsToDelete = await Scrim.find(query);
        
        // Delete scrim posts and bot-created scrim channels
        let channelsDeleted = 0;
        let messagesDeleted = 0;
        const deletionPromises = scrimsToDelete.map(async (scrim) => {
          // Delete scrim post message
          if (scrim.messageId && scrim.scrimPostChannelId) {
            try {
              const scrimPostChannel = interaction.guild.channels.cache.get(scrim.scrimPostChannelId);
              if (scrimPostChannel) {
                try {
                  const message = await scrimPostChannel.messages.fetch(scrim.messageId);
                  if (message) {
                    await message.delete();
                    messagesDeleted++;
                    console.log(`Deleted scrim post message for scrim ${scrim.scrimId}`);
                  }
                } catch (fetchError) {
                  if (fetchError.code === 10008) {
                    console.log(`Scrim post message ${scrim.messageId} for scrim ${scrim.scrimId} already deleted or not found`);
                  } else {
                    throw fetchError;
                  }
                }
              }
            } catch (error) {
              console.log(`Failed to delete scrim post for scrim ${scrim.scrimId}:`, error.message);
            }
          }
          
          // Delete bot-created scrim coordination channels
          if (scrim.channelId) {
            try {
              const channel = interaction.guild.channels.cache.get(scrim.channelId);
              if (channel) {
                // Only delete channels that are clearly bot-created scrim channels
                const isBotScrimChannel = (
                  channel.name.startsWith('scrim-') || 
                  channel.name.includes(`-${scrim.scrimId}-`) ||
                  (channel.topic && channel.topic.includes(`Scrim ID: ${scrim.scrimId}`)) ||
                  channel.name.match(/^scrim-\d{6}$/) // Matches pattern like "scrim-123456"
                );
                
                if (isBotScrimChannel) {
                  await channel.delete();
                  channelsDeleted++;
                  console.log(`Deleted bot-created channel for scrim ${scrim.scrimId}`);
                } else {
                  console.log(`Skipped channel ${channel.name} for scrim ${scrim.scrimId} - safety check failed`);
                }
              }
            } catch (error) {
              console.log(`Failed to delete channel for scrim ${scrim.scrimId}:`, error.message);
            }
          }
        });
        
        // Wait for all deletions to complete
        await Promise.allSettled(deletionPromises);

        // Delete scrims from database
        const result = await Scrim.deleteMany(query);
        
        // Reset team statistics to 0 when clearing scrims
        const teamsUpdated = await Team.updateMany(
          { guildId: interaction.guild.id },
          {
            $set: {
              matchesWon: 0,
              matchesLost: 0,
              scrimsWon: 0,
              scrimsLost: 0,
              wins: 0,
              losses: 0
            }
          }
        );
        
        // Create success embed
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Scrims Cleared & Content Deleted')
          .setDescription(`Successfully cleared **${result.deletedCount}** ${statusFilter === 'all' ? 'scrims' : `${statusFilter} scrims`} from the database.\n\n` +
                         `🔄 **Statistics Reset:** All team statistics have been reset to 0 for **${teamsUpdated.modifiedCount}** teams.\n\n` +
                         `📢 **Channels Deleted:** ${channelsDeleted} scrim channels were safely removed.\n\n` +
                         `💬 **Posts Deleted:** ${messagesDeleted} scrim posts were removed from channels.`)
          .setColor(0x00FF00)
          .setTimestamp()
          .setFooter({ 
            text: `Cleared by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
          });

        // Check if interaction is still valid before updating
        if (!interaction.replied && !interaction.deferred) {
          await interaction.update({
            embeds: [embed],
            components: []
          });
        } else {
          await interaction.followUp({
            embeds: [embed],
            flags: 64
          });
        }

        console.log(`${interaction.user.tag} cleared ${result.deletedCount} ${statusFilter} scrims and their channels in guild ${interaction.guild.name}`);
        
      } else if (customId.startsWith('clear_cancel_')) {
        const cancelEmbed = new EmbedBuilder()
          .setTitle('❌ Clear Operation Cancelled')
          .setDescription('No scrims were deleted.')
          .setColor(0x808080)
          .setTimestamp();

        // Check if interaction is still valid before updating
        if (!interaction.replied && !interaction.deferred) {
          await interaction.update({
            embeds: [cancelEmbed],
            components: []
          });
        } else {
          await interaction.followUp({
            embeds: [cancelEmbed],
            flags: 64
          });
        }
      }
      
    } catch (error) {
      console.error('Error in scrim clear handler:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `❌ Error processing clear operation: ${error.message}`,
            flags: 64
          });
        } else {
          await interaction.followUp({
            content: `❌ Error processing clear operation: ${error.message}`,
            flags: 64
          });
        }
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  }
};
