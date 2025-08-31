require('dotenv').config();
const mongoose = require('mongoose');
const Scrim = require('./database/models/Scrim');

async function createTestScrim() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Create a test scrim
    const testScrim = new Scrim({
      scrimId: 'TEST01',
      teamName: 'Test Team 1',
      teamLeader: 'test_leader_123',
      opposingTeamName: 'Test Team 2',
      date: '2024-01-15',
      time: '20:00',
      games: '3',
      status: 'accepted',
      guildId: '1234567890',
      channelId: '9876543210',
      pendingConfirmation: true,
      confirmationData: {
        wins: 2,
        losses: 1,
        resultsText: '**Test Results:**\nTest Team 1: 2 wins\nTest Team 2: 1 win\n\n',
        team1MatchWins: 6,
        team1MatchLosses: 3,
        team2MatchWins: 3,
        team2MatchLosses: 6,
        initiatingUserId: 'test_user_123'
      }
    });
    
    await testScrim.save();
    console.log(`Created test scrim with ID: ${testScrim._id}`);
    console.log('Use this ID to test the confirmation buttons');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestScrim();
