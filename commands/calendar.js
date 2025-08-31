const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Team = require('../database/models/Team');
const Scrim = require('../database/models/Scrim');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calendar')
    .setDescription('View your team\'s upcoming scrims'),
  
  async execute(interaction) {
    try {
      const userTeam = await Team.findOne({
        $or: [
          { leader: interaction.user.id },
          { 'members.userId': interaction.user.id }
        ],
        guildId: interaction.guild.id
      });
      
      if (!userTeam) {
        return await interaction.reply({
          content: '❌ You must be in a team to view the calendar.',
          ephemeral: true
        });
      }
      
      // Find all upcoming scrims for this team
      const upcomingScrims = await Scrim.find({
        $or: [
          { teamName: userTeam.name },
          { opposingTeamName: userTeam.name }
        ],
        status: { $in: ['open', 'accepted'] },
        guildId: interaction.guild.id
      }).sort({ date: 1, time: 1 });
      
      if (upcomingScrims.length === 0) {
        const noScrimsEmbed = new EmbedBuilder()
          .setTitle('📅 Team Calendar')
          .setDescription(`**Team:** ${userTeam.name}\n\n` +
                         `🗓️ No upcoming scrims scheduled.\n\n` +
                         `Use \`/scrim_create\` to create a new scrim!`)
          .setColor(0x00AE86)
          .setTimestamp();
        
        return await interaction.reply({ embeds: [noScrimsEmbed] });
      }
      
      // Create calendar embed
      let calendarDescription = `**Team:** ${userTeam.name}\n\n`;
      
      for (const scrim of upcomingScrims) {
        const isCreator = scrim.teamName === userTeam.name;
        const opponent = isCreator ? scrim.opposingTeamName || 'Waiting for opponent' : scrim.teamName;
        const statusEmoji = scrim.status === 'open' ? '🟡' : '🟢';
        const statusText = scrim.status === 'open' ? 'Open' : 'Accepted';
        
        // Parse date and time for better formatting
        let formattedDateTime = `${scrim.date} at ${scrim.time}`;
        try {
          const [year, month, day] = scrim.date.split('-').map(Number);
          const timeStr = scrim.time;
          
          // Try to parse time for Discord timestamp
          let hour = 0, minute = 0;
          const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
          const match = timeStr.toLowerCase().match(timeRegex);
          
          if (match) {
            hour = parseInt(match[1]);
            minute = parseInt(match[2] || '0');
            const period = match[3];
            
            if (period) {
              if (period === 'pm' && hour !== 12) hour += 12;
              if (period === 'am' && hour === 12) hour = 0;
            }
            
            const scrimDate = new Date(year, month - 1, day, hour, minute);
            if (!isNaN(scrimDate.getTime())) {
              const unixTimestamp = Math.floor(scrimDate.getTime() / 1000);
              formattedDateTime = `<t:${unixTimestamp}:F>`;
            }
          }
        } catch (error) {
          // Keep original format if parsing fails
        }
        
        calendarDescription += `${statusEmoji} **${scrim.scrimId}** - vs ${opponent}\n` +
                              `📅 ${formattedDateTime}\n` +
                              `🎮 ${scrim.games} games\n` +
                              `📊 Status: ${statusText}\n`;
        
        if (scrim.otherInfo) {
          calendarDescription += `📝 ${scrim.otherInfo}\n`;
        }
        
        calendarDescription += `\n`;
      }
      
      const calendarEmbed = new EmbedBuilder()
        .setTitle('📅 Team Calendar')
        .setDescription(calendarDescription)
        .setColor(0x00AE86)
        .setFooter({ text: `${upcomingScrims.length} upcoming scrim(s)` })
        .setTimestamp();
      
      await interaction.reply({ embeds: [calendarEmbed] });
      
    } catch (error) {
      console.error('Calendar command error:', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching the calendar. Please try again.',
        ephemeral: true
      });
    }
  }
};
