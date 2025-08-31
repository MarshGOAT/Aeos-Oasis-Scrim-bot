require('dotenv').config();
const mongoose = require('mongoose');
const Scrim = require('./database/models/Scrim');

async function createTestScrim() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Create a scrim for 1 hour and 5 minutes from now to test the reminder
    const now = new Date();
    const futureTime = new Date(now.getTime() + (65 * 60 * 1000)); // 1 hour 5 minutes from now
    
    const year = futureTime.getFullYear();
    const month = String(futureTime.getMonth() + 1).padStart(2, '0');
    const day = String(futureTime.getDate()).padStart(2, '0');
    const hour = futureTime.getHours();
    const minute = futureTime.getMinutes();
    
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${String(minute).padStart(2, '0')}`;
    
    console.log(`Creating test scrim for: ${dateStr} at ${timeStr}`);
    console.log(`This should trigger a reminder in about 5 minutes`);
    
    const testScrim = new Scrim({
      scrimId: 'TEST99',
      teamName: 'MARSHTEST',
      teamLeader: '907411548442603600', // Your user ID
      teamMembers: ['907411548442603600'],
      date: dateStr,
      time: timeStr,
      games: '3',
      otherInfo: 'Test scrim for reminder system',
      status: 'accepted',
      guildId: '1316020606101774373', // Your guild ID
      opposingTeamName: 'PUG IS BEST',
      opposingTeamLeader: '907411548442603600',
      opposingTeamMembers: ['907411548442603600'],
      reminderSent: false
    });
    
    await testScrim.save();
    console.log('Test scrim created successfully!');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestScrim();
