const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Scrim = require('../database/models/Scrim');
const Team = require('../database/models/Team');

// Function to update team statistics
async function updateTeamStats(teamName, guildId, matchWins, matchLosses, scrimWins, scrimLosses, scrimDraws = 0) {
  try {
    const TeamStats = require('../database/models/TeamStats');
    
    // Update or create team stats
    await TeamStats.findOneAndUpdate(
      { teamName: teamName, guildId: guildId },
      {
        $inc: {
          totalScrims: 1,
          wins: scrimWins,
          losses: scrimLosses,
          draws: scrimDraws,
          gamesWon: matchWins,
          gamesLost: matchLosses
        },
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );
    
    console.log(`Updated stats for ${teamName}: +${matchWins} games won, +${matchLosses} games lost, +${scrimWins} scrims won, +${scrimLosses} scrims lost, +${scrimDraws} scrims drawn`);
  } catch (error) {
    console.error(`Error updating stats for ${teamName}:`, error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_finish')
    .setDescription('Finish a scrim and close the channel')
    .addStringOption(option =>
      option.setName('scrim_id')
        .setDescription('The 6-digit scrim ID')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(6))
    .addIntegerOption(option =>
      option.setName('your_team_wins')
        .setDescription('Number of wins for your team')
        .setRequired(false)
        .setMinValue(0))
    .addIntegerOption(option =>
      option.setName('enemy_team_wins')
        .setDescription('Number of wins for enemy team')
        .setRequired(false)
        .setMinValue(0)),
  async execute(interaction) {
    try {
      const scrimId = interaction.options.getString('scrim_id');
      const yourTeamWins = interaction.options.getInteger('your_team_wins') || 0;
      const enemyTeamWins = interaction.options.getInteger('enemy_team_wins') || 0;
      
      // Validate scrim ID format
      if (!/^[0-9]{6}$/.test(scrimId)) {
        return await interaction.reply({
          content: '❌ Invalid scrim ID format. Please provide a 6-digit number.',
          flags: 64
        });
      }
      
      // Find the scrim in database by ID
      const scrim = await Scrim.findOne({
        scrimId: scrimId,
        guildId: interaction.guild.id
      });
      
      console.log('Finish command - Looking for scrim ID:', scrimId);
      console.log('Found scrim for finish:', scrim ? 'YES' : 'NO');
      
      if (!scrim) {
        return await interaction.reply({
          content: `❌ Could not find scrim with ID **${scrimId}**.`,
          flags: 64
        });
      }
      
      // Check if the scrim is already finished
      if (scrim.status === 'finished') {
        return await interaction.reply({
          content: `❌ This scrim (ID: **${scrimId}**) has already been finished. Please create a new scrim if needed.`,
          flags: 64
        });
      }
      
      // Check if the scrim is in accepted status
      if (scrim.status !== 'accepted') {
        return await interaction.reply({
          content: `❌ This scrim (ID: **${scrimId}**) is not in 'accepted' status. Current status: ${scrim.status}`,
          flags: 64
        });
      }
      
      // Determine which team the user belongs to
      // Check if user is from the opposing team (not the scrim creator's team)
      const Team = require('../database/models/Team');
      const userTeam = await Team.findOne({ 
        guildId: interaction.guild.id,
        $or: [
          { 'members.userId': interaction.user.id },
          { leader: interaction.user.id }
        ]
      });
      
      let actualTeam1Wins, actualTeam2Wins;
      
      if (userTeam && userTeam.name === scrim.opposingTeamName) {
        // User is from opposing team, so "your team" = team2, "enemy team" = team1
        actualTeam1Wins = enemyTeamWins;  // Enemy team wins go to team1 (MARSHTEST)
        actualTeam2Wins = yourTeamWins;   // Your team wins go to team2 (PUG IS BEST)
      } else {
        // User is from scrim creator's team, so "your team" = team1, "enemy team" = team2
        actualTeam1Wins = yourTeamWins;   // Your team wins go to team1
        actualTeam2Wins = enemyTeamWins;  // Enemy team wins go to team2
      }
      
      // Don't mark as finished yet - wait for confirmation
      // Just save the team wins for now
      scrim.actualTeam1Wins = actualTeam1Wins;
      scrim.actualTeam2Wins = actualTeam2Wins;
      await scrim.save();
      
      // Update team statistics - record individual games (matches)
      let team1MatchWins = actualTeam1Wins;  // Individual games won by team1
      let team1MatchLosses = actualTeam2Wins; // Individual games lost by team1 (= team2 wins)
      let team2MatchWins = actualTeam2Wins;   // Individual games won by team2
      let team2MatchLosses = actualTeam1Wins; // Individual games lost by team2 (= team1 wins)
      
      // Determine scrim outcome (who won the overall scrim)
      let team1ScrimWins = 0;
      let team1ScrimLosses = 0;
      let team1ScrimDraws = 0;
      let team2ScrimWins = 0;
      let team2ScrimLosses = 0;
      let team2ScrimDraws = 0;
      
      if (actualTeam1Wins > actualTeam2Wins) {
        // Team1 won the scrim
        team1ScrimWins = 1;
        team2ScrimLosses = 1;
      } else if (actualTeam2Wins > actualTeam1Wins) {
        // Team2 won the scrim
        team1ScrimLosses = 1;
        team2ScrimWins = 1;
      } else {
        // Scrim was a draw
        team1ScrimDraws = 1;
        team2ScrimDraws = 1;
      }
      
      // Don't update team statistics yet - wait for confirmation
      // Statistics will be updated when the scrim is confirmed
      
      console.log('Stats update completed, creating confirmation UI...');
      
      // Create results text
      let resultsText = '';
      if (actualTeam1Wins > 0 || actualTeam2Wins > 0) {
        const totalGames = actualTeam1Wins + actualTeam2Wins;
        
        resultsText = `**Score:** ${actualTeam1Wins} Wins (${scrim.teamName}) - ${actualTeam2Wins} Wins (${scrim.opposingTeamName || 'opposing team'}) (${totalGames} total games)\n`;
        
        // Determine overall scrim outcome
        let outcome = '';
        if (actualTeam1Wins > actualTeam2Wins) {
          outcome = `🏆 **SCRIM VICTORY: ${scrim.teamName}!**`;
        } else if (actualTeam2Wins > actualTeam1Wins) {
          outcome = `🏆 **SCRIM VICTORY: ${scrim.opposingTeamName || 'opposing team'}!**`;
        } else {
          outcome = '🤝 **SCRIM DRAW** (Equal wins)';
        }
        resultsText += `**Scrim Outcome:** ${outcome}\n`;
      } else {
        resultsText = `**No scores recorded** - Scrim completed without results\n`;
      }

      // Create confirmation message
      let confirmationMessage = '';
      if (actualTeam1Wins > 0 || actualTeam2Wins > 0) {
        confirmationMessage = `${resultsText}\n` +
                             `Please confirm these scores are correct. Both teams should agree before finalizing.`;
      } else {
        confirmationMessage = `**No score provided.** Are you sure you do not want to provide the scores first?\n\n` +
                             `If not, click confirm to finish this scrim and close the channel.`;
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirm Scrim Results')
        .setDescription(`**Scrim ID:** ${scrimId}\n` +
                       `**Teams:** ${scrim.teamName} vs ${scrim.opposingTeamName || 'opposing team'}\n\n` +
                       confirmationMessage)
        .setColor(0xFFAA00)
        .setThumbnail('https://cdn.discordapp.com/attachments/1316020606101774376/1318464842424836116/image.png')
        .setTimestamp();

      // Create confirmation buttons
      const confirmRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_scrim_${scrimId}`)
            .setLabel('✅ Confirm & Finish')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`unconfirm_scrim_${scrimId}`)
            .setLabel('❌ Cancel & Discuss')
            .setStyle(ButtonStyle.Danger)
        );

      // Store confirmation data in the database BEFORE replying
      scrim.pendingConfirmation = true;
      scrim.confirmationData = {
        actualTeam1Wins,
        actualTeam2Wins,
        resultsText,
        team1MatchWins,
        team1MatchLosses,
        team2MatchWins,
        team2MatchLosses,
        team1ScrimWins,
        team1ScrimLosses,
        team1ScrimDraws,
        team2ScrimWins,
        team2ScrimLosses,
        team2ScrimDraws,
        initiatingUserId: interaction.user.id
      };
      await scrim.save();
      console.log(`Saved confirmation data for scrim ${scrimId}`);

      await interaction.reply({ 
        embeds: [confirmEmbed], 
        components: [confirmRow]
      });
      console.log(`Sent confirmation UI for scrim ${scrimId}`);
      
    } catch (error) {
      console.error('Error finishing scrim:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ An error occurred while finishing the scrim: ${error.message}`,
          flags: 64
        });
      }
    }
  }
};
