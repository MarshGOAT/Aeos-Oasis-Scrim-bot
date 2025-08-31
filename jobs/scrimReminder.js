const { EmbedBuilder } = require('discord.js');
const Scrim = require('../database/models/Scrim');
const Team = require('../database/models/Team');

async function sendScrimReminders(client) {
  try {
    console.log('Checking for upcoming scrims to send reminders...');
    
    // Get current time
    const now = new Date();
    
    // Calculate time 1 hour from now (we'll send reminders for scrims starting in 1 hour)
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Find all accepted scrims that haven't finished
    const scrims = await Scrim.find({
      status: 'accepted',
      reminderSent: { $ne: true } // Only scrims that haven't had reminders sent
    });
    
    for (const scrim of scrims) {
      try {
        // Parse scrim date and time
        const [year, month, day] = scrim.date.split('-').map(Number);
        let hour, minute;
        
        // Handle different time formats
        const timeStr = scrim.time.toLowerCase();
        
        if (timeStr.includes(':')) {
          // Format like "10:20am" or "14:30"
          const timeParts = timeStr.split(':');
          hour = parseInt(timeParts[0]);
          const minutePart = timeParts[1];
          
          if (minutePart.includes('am') || minutePart.includes('pm')) {
            minute = parseInt(minutePart.replace(/[ap]m/g, ''));
            if (timeStr.includes('pm') && hour !== 12) {
              hour += 12;
            } else if (timeStr.includes('am') && hour === 12) {
              hour = 0;
            }
          } else {
            minute = parseInt(minutePart);
          }
        } else {
          // Format like "10am" or "2pm"
          const timeMatch = timeStr.match(/(\d+)(am|pm)/);
          if (timeMatch) {
            hour = parseInt(timeMatch[1]);
            minute = 0;
            if (timeMatch[2] === 'pm' && hour !== 12) {
              hour += 12;
            } else if (timeMatch[2] === 'am' && hour === 12) {
              hour = 0;
            }
          } else {
            hour = parseInt(timeStr);
            minute = 0;
          }
        }
        
        const scrimDateTime = new Date(year, month - 1, day, hour, minute);
        
        // Check if scrim is starting in approximately 1 hour (within 5 minute window)
        const timeDiff = scrimDateTime.getTime() - now.getTime();
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        if (timeDiff > (oneHour - fiveMinutes) && timeDiff <= (oneHour + fiveMinutes)) {
          console.log(`Sending reminder for scrim ${scrim.scrimId}`);
          
          // Get all participants
          const allParticipants = new Set();
          
          // Add original team members
          if (scrim.teamMembers && scrim.teamMembers.length > 0) {
            scrim.teamMembers.forEach(memberId => allParticipants.add(memberId));
          }
          if (scrim.teamLeader) {
            allParticipants.add(scrim.teamLeader);
          }
          
          // Add opposing team members
          if (scrim.opposingTeamMembers && scrim.opposingTeamMembers.length > 0) {
            scrim.opposingTeamMembers.forEach(memberId => allParticipants.add(memberId));
          }
          if (scrim.opposingTeamLeader) {
            allParticipants.add(scrim.opposingTeamLeader);
          }
          
          // Create reminder embed
          const reminderEmbed = new EmbedBuilder()
            .setTitle('⏰ SCRIM REMINDER')
            .setDescription(`**${scrim.teamName}** vs **${scrim.opposingTeamName}**\n\n` +
                           `🎮 **Scrim is happening in one hour!**\n\n` +
                           `📅 **Date & Time:** ${scrim.date} at ${scrim.time}\n` +
                           `🎯 **Games:** ${scrim.games}\n` +
                           `⚔️ **Scrim ID:** ${scrim.scrimId}\n\n` +
                           `Get ready and make sure you're available! 🔥`)
            .setColor(0xFFAA00)
            .setThumbnail('https://cdn.discordapp.com/attachments/1316020606101774376/1318464842424836116/image.png')
            .setTimestamp();
          
          // Send DMs to all participants
          const dmPromises = Array.from(allParticipants).map(async (userId) => {
            try {
              const user = await client.users.fetch(userId);
              await user.send({ embeds: [reminderEmbed] });
              console.log(`Sent reminder DM to ${user.username}`);
            } catch (error) {
              console.log(`Failed to send reminder DM to user ${userId}:`, error.message);
            }
          });
          
          // Wait for all DMs to be sent
          await Promise.allSettled(dmPromises);
          
          // Mark reminder as sent
          scrim.reminderSent = true;
          await scrim.save();
          
          console.log(`Reminder sent for scrim ${scrim.scrimId}`);
        }
        
      } catch (error) {
        console.error(`Error processing scrim ${scrim.scrimId}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Error in scrim reminder job:', error);
  }
}

module.exports = { sendScrimReminders };
