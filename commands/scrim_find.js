const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Scrim = require('../database/models/Scrim');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim_find')
    .setDescription('Find scrims around a specific date and time')
    .addStringOption(option =>
      option.setName('date')
        .setDescription('Date to search around (YYYY-MM-DD)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Time to search around (e.g. 6pm, 14:30)')
        .setRequired(true)),
  
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const searchDate = interaction.options.getString('date');
      const searchTime = interaction.options.getString('time');
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
        return await interaction.editReply({
          content: '❌ Invalid date format. Use YYYY-MM-DD'
        });
      }
      
      // Parse search time
      let parsedSearchTime;
      try {
        const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?$/;
        const match = searchTime.trim().match(timeRegex);
        
        if (!match) {
          const time24Regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
          const match24 = searchTime.trim().match(time24Regex);
          if (match24) {
            parsedSearchTime = `${match24[1].padStart(2, '0')}:${match24[2]}`;
          } else {
            throw new Error('Invalid time format');
          }
        } else {
          let hours = parseInt(match[1]);
          const minutes = parseInt(match[2] || '0');
          const period = match[3] ? match[3].toLowerCase() : null;
          
          if (period === 'pm' && hours !== 12) hours += 12;
          if (period === 'am' && hours === 12) hours = 0;
          
          if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            throw new Error('Invalid time values');
          }
          
          parsedSearchTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      } catch (error) {
        return await interaction.editReply({
          content: '❌ Invalid time format. Use formats like: 6pm, 2:30pm, 14:30'
        });
      }
      
      // Create target datetime for comparison
      const targetDateTime = new Date(`${searchDate}T${parsedSearchTime}:00`);
      
      // Find all open scrims
      const scrims = await Scrim.find({
        guildId: interaction.guild.id,
        status: 'open'
      });
      
      if (scrims.length === 0) {
        return await interaction.editReply({
          content: '❌ No open scrims found.'
        });
      }
      
      // Calculate time differences and sort by closest
      const scrimsWithDistance = scrims.map(scrim => {
        try {
          // Parse scrim time
          let scrimParsedTime;
          const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?$/;
          const match = scrim.time.trim().match(timeRegex);
          
          if (!match) {
            const time24Regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
            const match24 = scrim.time.trim().match(time24Regex);
            if (match24) {
              scrimParsedTime = `${match24[1].padStart(2, '0')}:${match24[2]}`;
            } else {
              return null;
            }
          } else {
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2] || '0');
            const period = match[3] ? match[3].toLowerCase() : null;
            
            if (period === 'pm' && hours !== 12) hours += 12;
            if (period === 'am' && hours === 12) hours = 0;
            
            scrimParsedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          }
          
          const scrimDateTime = new Date(`${scrim.date}T${scrimParsedTime}:00`);
          const timeDiff = Math.abs(targetDateTime.getTime() - scrimDateTime.getTime());
          
          return {
            scrim,
            timeDiff,
            scrimDateTime
          };
        } catch (error) {
          return null;
        }
      }).filter(item => item !== null);
      
      if (scrimsWithDistance.length === 0) {
        return await interaction.editReply({
          content: '❌ No valid scrims found with parseable times.'
        });
      }
      
      // Sort by time difference and take top 3
      scrimsWithDistance.sort((a, b) => a.timeDiff - b.timeDiff);
      const closestScrims = scrimsWithDistance.slice(0, 3);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`🔍 Scrims Near ${searchDate} at ${searchTime}`)
        .setColor(0x00AE86)
        .setTimestamp();
      
      let description = `Found ${closestScrims.length} closest scrim${closestScrims.length !== 1 ? 's' : ''}:\n\n`;
      
      closestScrims.forEach((item, index) => {
        const { scrim } = item;
        const hoursDiff = Math.round(item.timeDiff / (1000 * 60 * 60));
        const daysDiff = Math.round(item.timeDiff / (1000 * 60 * 60 * 24));
        
        let timeDiffText;
        if (daysDiff > 0) {
          timeDiffText = `${daysDiff} day${daysDiff !== 1 ? 's' : ''} away`;
        } else if (hoursDiff > 0) {
          timeDiffText = `${hoursDiff} hour${hoursDiff !== 1 ? 's' : ''} away`;
        } else {
          timeDiffText = 'Very close time';
        }
        
        description += `**${index + 1}.** **${scrim.teamName}**\n`;
        description += `📅 ${scrim.date} at ${scrim.time} *(${timeDiffText})*\n`;
        description += `🎮 ${scrim.games} games\n`;
        description += `🆔 \`${scrim.scrimId}\`\n\n`;
      });
      
      embed.setDescription(description);
      
      await interaction.editReply({
        embeds: [embed]
      });
      
    } catch (error) {
      console.error('Scrim find error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while searching for scrims.'
      });
    }
  }
};
