
const Team = require('../database/models/Team');
const Scrim = require('../database/models/Scrim');
const { EmbedBuilder } = require('discord.js');

// Helper function to update team stats (only need one version)
async function updateTeamStats(teamName, guildId, matchWins, matchLosses, scrimWins, scrimLosses, scrimDraws = 0) {
  try {
    const team = await Team.findOne({ name: teamName, guildId: guildId });
    if (team) {
      team.matchesWon = (team.matchesWon || 0) + matchWins;
      team.matchesLost = (team.matchesLost || 0) + matchLosses;
      team.scrimsWon = (team.scrimsWon || 0) + scrimWins;
      team.scrimsLost = (team.scrimsLost || 0) + scrimLosses;
      team.scrimsDrawn = (team.scrimsDrawn || 0) + scrimDraws;
      // Update legacy fields for backward compatibility
      team.wins = (team.wins || 0) + matchWins;
      team.losses = (team.losses || 0) + matchLosses;
      await team.save();
      console.log(`Updated stats for ${teamName}: +${matchWins} match wins, +${matchLosses} match losses, +${scrimWins} scrim wins, +${scrimLosses} scrim losses, +${scrimDraws} scrim draws`);
    } else {
      console.log(`Team ${teamName} not found for stats update`);
    }
  } catch (error) {
    console.error(`Error updating stats for ${teamName}:`, error);
  }
}

// This is a handler file, not a slash command
module.exports = {
  name: 'scrim_confirm_handler', // Use name instead of data for handlers
  async execute(interaction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    
    if (customId.startsWith('confirm_scrim_') || customId.startsWith('unconfirm_scrim_')) {
      const scrimId = customId.split('_')[2];
      
      // Get stored scrim data
      console.log(`Looking for scrim with ID: ${scrimId}`);
      const scrim = await Scrim.findOne({ scrimId: scrimId });
      console.log(`Found scrim:`, scrim ? `Status: ${scrim.status}, Pending: ${scrim.pendingConfirmation}` : 'null');
      
      if (!scrim) {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({ 
            content: `❌ Scrim with ID ${scrimId} not found in database. The scrim may have been deleted.`, 
            flags: 64
          });
        } else {
          return await interaction.followUp({ 
            content: `❌ Scrim with ID ${scrimId} not found in database. The scrim may have been deleted.`, 
            flags: 64
          });
        }
      }
      
      // Allow confirmation for accepted scrims OR scrims that are finished but have pending confirmation
      if (!scrim.pendingConfirmation && scrim.status !== 'accepted' && scrim.status !== 'finished') {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({ 
            content: `❌ This scrim is not available for confirmation (Status: ${scrim.status}).`, 
            flags: 64
          });
        } else {
          return await interaction.followUp({ 
            content: `❌ This scrim is not available for confirmation (Status: ${scrim.status}).`, 
            flags: 64
          });
        }
      }
      
      // Handle direct confirmation from channel button (no /scrim_finish used)
      let scrimData = scrim.confirmationData;
      if (!scrimData && scrim.status === 'accepted') {
        // Create default confirmation data for direct confirmation
        scrimData = {
          wins: 0,
          losses: 0,
          resultsText: 'Scrim completed without recorded scores.\n',
          team1MatchWins: 0,
          team1MatchLosses: 0,
          team2MatchWins: 0,
          team2MatchLosses: 0,
          team1ScrimWins: 0,
          team1ScrimLosses: 0,
          team1ScrimDraws: 1,
          team2ScrimWins: 0,
          team2ScrimLosses: 0,
          team2ScrimDraws: 1,
          initiatingUserId: interaction.user.id
        };
      }

      // Find which team the user belongs to
      const userId = interaction.user.id;
      const userTeam = await Team.findOne({
        $or: [
          { leader: userId, guildId: interaction.guild.id },
          { 'members.userId': userId, guildId: interaction.guild.id }
        ]
      });

      if (!userTeam) {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({
            content: '❌ You must be part of a team to confirm scrim results.',
            flags: 64
          });
        } else {
          return await interaction.followUp({
            content: '❌ You must be part of a team to confirm scrim results.',
            flags: 64
          });
        }
      }

      // Check if user is part of either the original team or opposing team in the scrim
      const isOriginalTeam = userTeam.name === scrim.teamName || 
                           userTeam.name.toLowerCase() === scrim.teamName.toLowerCase();
      const isOpposingTeam = userTeam.name === scrim.opposingTeamName || 
                           (scrim.opposingTeamName && userTeam.name.toLowerCase() === scrim.opposingTeamName.toLowerCase());
      
      // Debug logging
      console.log(`User team: ${userTeam.name}`);
      console.log(`Scrim team name: ${scrim.teamName}`);
      console.log(`Scrim opposing team: ${scrim.opposingTeamName}`);
      console.log(`Is original team: ${isOriginalTeam}, Is opposing team: ${isOpposingTeam}`);
      
      if (!isOriginalTeam && !isOpposingTeam) {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({
            content: '❌ You must be part of one of the teams in this scrim to confirm results.',
            flags: 64
          });
        } else {
          return await interaction.followUp({
            content: '❌ You must be part of one of the teams in this scrim to confirm results.',
            flags: 64
          });
        }
      }

      // Check if the user who initiated the finish is the same as the current user
      const initiatingUserId = scrimData.initiatingUserId;
      const initiatingUserTeam = await Team.findOne({
        $or: [
          { leader: initiatingUserId, guildId: interaction.guild.id },
          { 'members.userId': initiatingUserId, guildId: interaction.guild.id }
        ]
      });
      
      // Determine if the initiating user is from the same team as the current user
      const isSameTeam = initiatingUserTeam && userTeam.name === initiatingUserTeam.name;
      
      if (customId.startsWith('confirm_scrim_')) {
        // Only allow opposing team to confirm
        if (isSameTeam) {
          if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({
              content: '❌ Only the opposing team can confirm the results. Please wait for the other team to confirm.',
              flags: 64
            });
          } else {
            return await interaction.followUp({
              content: '❌ Only the opposing team can confirm the results. Please wait for the other team to confirm.',
              flags: 64
            });
          }
        }
        
        try {
          // Update scrim status to finished
          scrim.status = 'finished';
          scrim.wins = scrimData.wins;
          scrim.losses = scrimData.losses;
          scrim.finishedAt = new Date();
          scrim.pendingConfirmation = false;
          await scrim.save();

          // Update team statistics with proper match and scrim tracking
          console.log(`Updating stats for ${scrim.teamName}: ${scrimData.team1MatchWins} match wins, ${scrimData.team1MatchLosses} match losses, ${scrimData.team1ScrimWins || 0} scrim wins, ${scrimData.team1ScrimLosses || 0} scrim losses, ${scrimData.team1ScrimDraws || 0} scrim draws`);
          
          // Update team statistics in TeamStats model
          if (scrimData.actualTeam1Wins !== undefined && scrimData.actualTeam2Wins !== undefined) {
            const TeamStats = require('../database/models/TeamStats');
            
            // Update team1 stats
            await TeamStats.findOneAndUpdate(
              { teamName: scrim.teamName, guildId: interaction.guild.id },
              {
                $inc: {
                  totalScrims: 1,
                  wins: scrimData.team1ScrimWins || 0,
                  losses: scrimData.team1ScrimLosses || 0,
                  draws: scrimData.team1ScrimDraws || 0,
                  gamesWon: scrimData.team1MatchWins || 0,
                  gamesLost: scrimData.team1MatchLosses || 0
                },
                lastUpdated: new Date()
              },
              { upsert: true, new: true }
            );
            
            // Update team2 stats
            await TeamStats.findOneAndUpdate(
              { teamName: scrim.opposingTeamName, guildId: interaction.guild.id },
              {
                $inc: {
                  totalScrims: 1,
                  wins: scrimData.team2ScrimWins || 0,
                  losses: scrimData.team2ScrimLosses || 0,
                  draws: scrimData.team2ScrimDraws || 0,
                  gamesWon: scrimData.team2MatchWins || 0,
                  gamesLost: scrimData.team2MatchLosses || 0
                },
                lastUpdated: new Date()
              },
              { upsert: true, new: true }
            );
            
            console.log(`Updated TeamStats for both teams: ${scrim.teamName} and ${scrim.opposingTeamName}`);
          }

          // Remove temporary substitutes after scrim completion
          try {
            const teams = await Team.find({ guildId: interaction.guild.id });
            for (const team of teams) {
              const tempSubsToRemove = team.members.filter(member => 
                member.isTemporary === true && member.scrimId === scrimId
              );
              
              if (tempSubsToRemove.length > 0) {
                team.members = team.members.filter(member => 
                  !(member.isTemporary === true && member.scrimId === scrimId)
                );
                await team.save();
                console.log(`Removed ${tempSubsToRemove.length} temporary substitutes from ${team.name}`);
              }
            }
          } catch (tempSubError) {
            console.error('Error removing temporary substitutes:', tempSubError);
          }

          // Create final embed
          const finishEmbed = new EmbedBuilder()
            .setTitle('🏁 Scrim Confirmed & Finished!')
            .setDescription(`**Scrim ID:** ${scrimId}\n` +
                           `**Teams:** ${scrim.teamName} vs ${scrim.opposingTeamName || 'opposing team'}\n\n` +
                           scrimData.resultsText +
                           `**Date:** ${scrim.date} at ${scrim.time}\n` +
                           `**Games Played:** ${scrim.games}\n\n` +
                           `Thanks for playing! This channel will be deleted in 5 seconds.\n` +
                           `*Statistics have been updated for both teams.*`)
            .setColor(0x00FF00)
            .setThumbnail('https://cdn.discordapp.com/attachments/1316020606101774376/1318464842424836116/image.png')
            .setTimestamp();

          await interaction.update({ 
            embeds: [finishEmbed], 
            components: [] 
          });

          // Store the channel reference before the timeout
          const channelToDelete = interaction.channel;
          const channelName = channelToDelete.name;
          
          // Delete the channel after 5 seconds instead of 30
          setTimeout(async () => {
            try {
              console.log(`Attempting to delete channel: ${channelName} (ID: ${channelToDelete.id})`);
              
              // Check if channel still exists and is deletable
              if (channelToDelete && channelToDelete.deletable) {
                await channelToDelete.delete('Scrim finished');
                console.log(`Successfully deleted channel: ${channelName}`);
              } else {
                console.log(`Channel ${channelName} is not deletable or doesn't exist`);
              }
            } catch (error) {
              console.error(`Error deleting scrim channel ${channelName}:`, error);
            }
          }, 5000);

        } catch (error) {
          console.error('Error confirming scrim:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: `❌ An error occurred while confirming the scrim: ${error.message}`,
              flags: 64
            });
          } else {
            await interaction.followUp({
              content: `❌ An error occurred while confirming the scrim: ${error.message}`,
              flags: 64
            });
          }
        }

      } else if (customId.startsWith('unconfirm_scrim_')) {
        try {
          // Allow any team member to cancel, not just opposing team
          scrim.pendingConfirmation = false;
          await scrim.save();
          
          const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Scrim Confirmation Cancelled')
            .setDescription(`**Scrim ID:** ${scrimId}\n` +
                           `**Teams:** ${scrim.teamName} vs ${scrim.opposingTeamName || 'opposing team'}\n\n` +
                           `Confirmation cancelled. The channel will remain open for discussion.\n` +
                           `Use \`/scrim_finish ${scrimId}\` again when you're ready to finalize the results.`)
            .setColor(0xFF4444)
            .setTimestamp();

          await interaction.update({ 
            embeds: [cancelEmbed], 
            components: [] 
          });
        } catch (error) {
          console.error('Error cancelling scrim confirmation:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: `❌ An error occurred while cancelling the confirmation: ${error.message}`,
              flags: 64
            });
          } else {
            await interaction.followUp({
              content: `❌ An error occurred while cancelling the confirmation: ${error.message}`,
              flags: 64
            });
          }
        }
      }
    } else if (customId.startsWith('scrim_finish_')) {
      // Handle direct finish button from channel
      const scrimId = customId.split('_')[2];
      
      // Get stored scrim data
      const scrim = await Scrim.findOne({ scrimId: scrimId });
      
      if (!scrim) {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({ 
            content: `❌ Scrim with ID ${scrimId} not found in database.`, 
            flags: 64
          });
        } else {
          return await interaction.followUp({ 
            content: `❌ Scrim with ID ${scrimId} not found in database.`, 
            flags: 64
          });
        }
      }
      
      if (scrim.status === 'finished') {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({ 
            content: `❌ This scrim has already been finished. Please create a new scrim if needed.`, 
            flags: 64
          });
        } else {
          return await interaction.followUp({ 
            content: `❌ This scrim has already been finished. Please create a new scrim if needed.`, 
            flags: 64
          });
        }
      }
      
      // Instruct user to use the slash command
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `Please use the \`/scrim_finish ${scrimId}\` command to finish this scrim and record results.`,
          flags: 64
        });
      } else {
        await interaction.followUp({
          content: `Please use the \`/scrim_finish ${scrimId}\` command to finish this scrim and record results.`,
          flags: 64
        });
      }
    }
  }
};
