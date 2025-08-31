const mongoose = require('mongoose');
const Team = require('./database/models/Team');
require('dotenv').config();

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const teams = await Team.find({});
    console.log('\n=== TEAMS IN DATABASE ===');
    
    if (teams.length === 0) {
      console.log('No teams found in database');
    } else {
      teams.forEach((team, index) => {
        console.log(`\n${index + 1}. Team: ${team.name}`);
        console.log(`   Leader: ${team.leader}`);
        console.log(`   Members: ${team.members.length}`);
        console.log(`   Guild: ${team.guildId}`);
        console.log(`   Role ID: ${team.roleId || 'None'}`);
        console.log(`   Created: ${team.createdAt}`);
        
        team.members.forEach((member, i) => {
          console.log(`   Member ${i + 1}: ${member.username} (${member.userId})`);
        });
      });
    }
    
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabase();
