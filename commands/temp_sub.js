const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Team = require('../database/models/Team');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temp_sub')
    .setDescription('Temporarily invite someone from another team to substitute for a scrim')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to invite as a temporary substitute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('scrim_id')
        .setDescription('The scrim ID they will be subbing for')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const scrimId = interaction.options.getString('scrim_id');
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      await interaction.deferReply({ ephemeral: true });

      // Check if user is a team leader
      const team = await Team.findOne({
        leader: userId,
        guildId: guildId
      });

      if (!team) {
        return await interaction.editReply({
          content: '❌ You must be a team leader to invite temporary substitutes.'
        });
      }

      // Check if target user is already in this team
      const isAlreadyMember = team.members.some(member => member.userId === targetUser.id);
      if (isAlreadyMember) {
        return await interaction.editReply({
          content: '❌ This user is already a member of your team.'
        });
      }

      // Check current temp subs for this scrim
      const currentTempSubs = (team.activeTempSubs || []).filter(tempSub => 
        tempSub.scrimId === scrimId
      );

      if (currentTempSubs.length >= 3) {
        return await interaction.editReply({
          content: '❌ This team already has the maximum number of temporary substitutes (3) for this scrim.'
        });
      }

      // Check if user is already a temp sub
      const isAlreadyTempSub = currentTempSubs.some(tempSub => tempSub.userId === targetUser.id);
      if (isAlreadyTempSub) {
        return await interaction.editReply({
          content: '❌ This user is already a temporary substitute for your team.'
        });
      }

      // Generate unique invite ID for temp sub
      const inviteId = `${team._id}_${targetUser.id}_${scrimId}_${Date.now()}`;
      
      // Store pending temp sub invite in team document
      if (!team.pendingTempSubs) {
        team.pendingTempSubs = [];
      }
      
      team.pendingTempSubs.push({
        inviteId: inviteId,
        userId: targetUser.id,
        username: targetUser.username,
        invitedBy: interaction.user.id,
        invitedAt: new Date(),
        guildId: guildId,
        scrimId: scrimId
      });
      
      await team.save();

      await interaction.editReply({
        content: `📨 Temp sub invite sent to ${targetUser.username}! They will receive a DM to accept or decline.`
      });

      // Send DM with accept/decline buttons
      try {
        const inviteEmbed = new EmbedBuilder()
          .setTitle('🎮 Temporary Substitute Invitation')
          .setDescription(`You've been invited as a temporary substitute for **${team.name}**!\n\n` +
                         `**Scrim ID:** ${scrimId}\n` +
                         `**Server:** ${interaction.guild.name}\n` +
                         `**Invited by:** ${interaction.user.tag}\n\n` +
                         `You will be automatically removed from the team after the scrim is completed.\n\n` +
                         `Would you like to accept this temporary substitute invitation?`)
          .setColor(0x1E90FF)
          .setThumbnail(interaction.guild.iconURL())
          .setTimestamp();

        const acceptButton = new ButtonBuilder()
          .setCustomId(`tempSubAccept_${inviteId}`)
          .setLabel('✅ Accept')
          .setStyle(ButtonStyle.Success);

        const declineButton = new ButtonBuilder()
          .setCustomId(`tempSubDecline_${inviteId}`)
          .setLabel('❌ Decline')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

        await targetUser.send({ embeds: [inviteEmbed], components: [row] });
        
      } catch (error) {
        console.log(`Could not DM user ${targetUser.username}:`, error);
        
        // Remove the pending invite if DM failed
        team.pendingTempSubs = team.pendingTempSubs.filter(invite => invite.inviteId !== inviteId);
        await team.save();
        
        return await interaction.editReply({
          content: `❌ Could not send DM to ${targetUser.username}. They may have DMs disabled. Invite cancelled.`
        });
      }

    } catch (error) {
      console.error('Error adding temporary substitute:', error);
      await interaction.editReply({
        content: '❌ An error occurred while adding the temporary substitute.'
      });
    }
  }
};
