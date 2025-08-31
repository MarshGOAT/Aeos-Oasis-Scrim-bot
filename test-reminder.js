require('dotenv').config();
const mongoose = require('mongoose');
const Scrim = require('./database/models/Scrim');

async function testReminderLogic() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get current time
    const now = new Date();
    console.log('Current time:', now.toISOString());
    console.log('Current local time:', now.toLocaleString());
    
    // Find all accepted scrims
    const scrims = await Scrim.find({
      status: 'accepted'
    });
    
    console.log(`Found ${scrims.length} accepted scrims:`);
    
    for (const scrim of scrims) {
      console.log(`\nScrim ${scrim.scrimId}:`);
      console.log(`  Teams: ${scrim.teamName} vs ${scrim.opposingTeamName}`);
      console.log(`  Date: ${scrim.date}`);
      console.log(`  Time: ${scrim.time}`);
      console.log(`  Reminder sent: ${scrim.reminderSent}`);
      
      // Parse scrim date and time
      try {
        const [year, month, day] = scrim.date.split('-').map(Number);
        let hour, minute;
        
        // Handle different time formats
        const timeStr = scrim.time.toLowerCase();
        console.log(`  Raw time string: "${scrim.time}" -> "${timeStr}"`);
        
        if (timeStr.includes(':')) {
          // Format like "10:20am" or "14:30"
          const timeParts = timeStr.split(':');
          hour = parseInt(timeParts[0]);
          const minutePart = timeParts[1];
          console.log(`  Time parts: hour=${hour}, minutePart="${minutePart}"`);
          
          if (minutePart.includes('am') || minutePart.includes('pm')) {
            minute = parseInt(minutePart.replace(/[ap]m/g, ''));
            console.log(`  Extracted minute: ${minute}`);
            if (timeStr.includes('pm') && hour !== 12) {
              hour += 12;
              console.log(`  Converted to PM: hour=${hour}`);
            } else if (timeStr.includes('am') && hour === 12) {
              hour = 0;
              console.log(`  Converted 12am to 0: hour=${hour}`);
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
        
        console.log(`  Final parsed: hour=${hour}, minute=${minute}`);
        const scrimDateTime = new Date(year, month - 1, day, hour, minute);
        console.log(`  Parsed datetime: ${scrimDateTime.toISOString()}`);
        console.log(`  Parsed local time: ${scrimDateTime.toLocaleString()}`);
        
        // Check time difference
        const timeDiff = scrimDateTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        console.log(`  Time difference: ${hoursDiff.toFixed(2)} hours`);
        
        // Check if it's within 1 hour window
        const oneHour = 60 * 60 * 1000;
        const fiveMinutes = 5 * 60 * 1000;
        
        if (timeDiff > (oneHour - fiveMinutes) && timeDiff <= (oneHour + fiveMinutes)) {
          console.log(`  ✅ SHOULD SEND REMINDER!`);
        } else {
          console.log(`  ❌ Not in reminder window`);
        }
        
      } catch (error) {
        console.log(`  Error parsing time: ${error.message}`);
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testReminderLogic();
