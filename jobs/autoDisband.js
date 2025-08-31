// Scheduled job to auto-disband inactive teams
const fs = require('fs');
const path = require('path');
const teamsPath = path.join(__dirname, '../data/teams.json');

function autoDisbandTeams() {
  let teams = JSON.parse(fs.readFileSync(teamsPath));
  const now = Date.now();
  const INACTIVITY_LIMIT = 30 * 24 * 60 * 60 * 1000; // 30 days
  teams.teams = teams.teams.filter(team => {
    if (now - team.lastActivity > INACTIVITY_LIMIT) {
      // Optionally notify team members here
      return false; // Remove team
    }
    return true;
  });
  fs.writeFileSync(teamsPath, JSON.stringify(teams, null, 2));
}

module.exports = { autoDisbandTeams };
