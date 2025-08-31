const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Team = require('../database/models/Team');

// /team invite @user
module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_invite')
    .setDescription('Invite a user to your team')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to invite')
        .setRequired(true)),
  async execute(interaction) {
    try {
      // Defer immediately to prevent timeout
      await interaction.deferReply({ ephemeral: true });
      
      const targetUser = interaction.options.getUser('user');
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Check if the inviter is a team leader
      const team = await Team.findOne({
        leader: userId,
        guildId: guildId
      });

      if (!team) {
        return await interaction.editReply({
          content: '❌ You must be a team leader to invite members. Create a team first.'
        });
      }

      // Check if target user is already in any team
      const targetUserTeam = await Team.findOne({
        $or: [
          { leader: targetUser.id },
          { 'members.userId': targetUser.id }
        ],
        guildId: guildId
      });

      if (targetUserTeam) {
        return await interaction.editReply({
          content: `❌ ${targetUser.username} is already in team **${targetUserTeam.name}**.`
        });
      }

      // Check if user is trying to invite themselves
      if (targetUser.id === userId) {
        return await interaction.editReply({
          content: '❌ You cannot invite yourself.'
        });
      }

      // Check team size limit (optional - adjust as needed)
      if (team.members.length >= 6) {
        return await interaction.editReply({
          content: '❌ Your team is full (maximum 6 members).'
        });
      }

      // Generate unique invite ID
      const inviteId = `${team._id}_${targetUser.id}_${Date.now()}`;
      
      // Store pending invite in team document
      if (!team.pendingInvites) {
        team.pendingInvites = [];
      }
      
      team.pendingInvites.push({
        inviteId: inviteId,
        userId: targetUser.id,
        username: targetUser.username,
        invitedBy: interaction.user.id,
        invitedAt: new Date(),
        guildId: guildId
      });
      
      await team.save();

      // Send DM with accept/decline buttons
      try {
        const inviteEmbed = new EmbedBuilder()
          .setTitle('🎮 Team Invitation')
          .setDescription(`You've been invited to join team **${team.name}**!\n\n` +
                         `**Server:** ${interaction.guild.name}\n` +
                         `**Invited by:** ${interaction.user.tag}\n\n` +
                         `Would you like to accept this team invitation?`)
          .setColor(0x1E90FF)
          .setThumbnail(interaction.guild.iconURL())
          .setTimestamp();

        const acceptButton = new ButtonBuilder()
          .setCustomId(`teamInviteAccept_${inviteId}`)
          .setLabel('✅ Accept')
          .setStyle(ButtonStyle.Success);

        const declineButton = new ButtonBuilder()
          .setCustomId(`teamInviteDecline_${inviteId}`)
          .setLabel('❌ Decline')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

        await targetUser.send({ embeds: [inviteEmbed], components: [row] });
        
        // Success - send confirmation
        await interaction.editReply({
          content: `📨 Team invite sent to ${targetUser.username}! They will receive a DM to accept or decline.`
        });
        
      } catch (error) {
        console.log(`Could not DM user ${targetUser.username}:`, error);
        
        // Remove the pending invite if DM failed
        team.pendingInvites = team.pendingInvites.filter(invite => invite.inviteId !== inviteId);
        await team.save();
        
        return await interaction.editReply({
          content: `❌ Could not send DM to ${targetUser.username}. They may have DMs disabled. Invite cancelled.`
        });
      }

    } catch (error) {
      console.error('Error inviting user to team:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: '❌ An error occurred while inviting the user. Please try again.',
            ephemeral: true
          });
        } catch (replyError) {
          console.error('Failed to send error reply:', replyError);
        }
      }
    }
  }
};
