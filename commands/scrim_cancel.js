const { SlashCommandBuilder } = require('@discordjs/builders');
const Scrim = require('../database/models/Scrim');
const Team = require('../database/models/Team');

// /scrim cancel <scrim_id>
module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_cancel')
    .setDescription('Cancel a scrim')
    .addStringOption(option =>
      option.setName('scrim_id')
        .setDescription('Scrim ID to cancel')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const scrimId = interaction.options.getString('scrim_id');
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Find the scrim (allow cancelling accepted scrims too)
      const scrim = await Scrim.findOne({ 
        scrimId: scrimId, 
        guildId: guildId,
        status: { $in: ['open', 'accepted'] }
      });

      if (!scrim) {
        return await interaction.reply({
          content: `❌ Scrim with ID **${scrimId}** not found or already cancelled.`,
          flags: 64
        });
      }

      // Check if user is part of either team (allow any team member to cancel from private channels)
      const team1 = await Team.findOne({ name: scrim.teamName, guildId: guildId });
      const team2 = await Team.findOne({ name: scrim.opposingTeamName, guildId: guildId });
      
      const isTeam1Member = team1 && (team1.leader === userId || team1.members.some(m => m.userId === userId));
      const isTeam2Member = team2 && (team2.leader === userId || team2.members.some(m => m.userId === userId));
      
      if (!isTeam1Member && !isTeam2Member) {
        return await interaction.reply({
          content: `❌ Only team members from either team can cancel this scrim.`,
          flags: 64
        });
      }

      // Store original status before updating
      const wasAccepted = scrim.status === 'accepted';
      const currentChannel = interaction.channel;
      
      // Update scrim status to cancelled
      scrim.status = 'cancelled';
      await scrim.save();

      // If cancelled from private channel, delete it immediately without DMs or replies
      if (wasAccepted && scrim.channelId && currentChannel.id === scrim.channelId) {
        try {
          // Send DMs before deleting channel
          const team1Members = team1 ? [team1.leader, ...team1.members.map(m => m.userId)] : [];
          const team2Members = team2 ? [team2.leader, ...team2.members.map(m => m.userId)] : [];
          const allMembers = [...new Set([...team1Members, ...team2Members])];

          for (const memberId of allMembers) {
            try {
              const user = await interaction.client.users.fetch(memberId);
              await user.send(`🚫 **Scrim Cancelled**\n\n` +
                             `**Scrim ID:** ${scrimId}\n` +
                             `**Teams:** ${scrim.teamName} vs ${scrim.opposingTeamName || 'opposing team'}\n` +
                             `**Date:** ${scrim.date} at ${scrim.time}\n\n` +
                             `The scrim has been cancelled by a team member.`);
            } catch (dmError) {
              console.log(`Could not send DM to user ${memberId}:`, dmError.message);
            }
          }
          
          // Delete the private channel
          await currentChannel.delete('Scrim cancelled');
          console.log(`Deleted private scrim channel: ${currentChannel.name}`);
          return; // Exit early since channel is deleted
        } catch (error) {
          console.log('Could not delete private scrim channel:', error.message);
        }
      }

      // Try to delete the original scrim post message
      if (scrim.messageId && scrim.scrimPostChannelId) {
        try {
          const channel = interaction.guild.channels.cache.get(scrim.scrimPostChannelId);
          if (channel) {
            const message = await channel.messages.fetch(scrim.messageId);
            if (message) {
              await message.delete();
            }
          }
        } catch (error) {
          console.log('Could not delete original scrim message:', error.message);
        }
      }

      // Send reply for non-private channel cancellations
      await interaction.reply({
        content: `✅ Scrim **${scrimId}** has been cancelled.`,
        flags: 64
      });

    } catch (error) {
      console.error('Error cancelling scrim:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ An error occurred while cancelling the scrim: ${error.message}`,
          flags: 64
        });
      }
    }
  }
};
