const mongoose = require('mongoose');

const scrimSchema = new mongoose.Schema({
  scrimId: {
    type: String,
    required: true,
    unique: true,
    length: 6
  },
  teamName: {
    type: String,
    required: true
  },
  teamLeader: {
    type: String,
    required: true
  },
  teamMembers: [{
    type: String
  }],
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  games: {
    type: String,
    required: true
  },
  otherInfo: {
    type: String,
    default: ''
  },
  guildId: {
    type: String,
    required: true
  },
  messageId: {
    type: String,
    required: false
  },
  scrimPostChannelId: {
    type: String,
    required: false
  },
  channelId: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['open', 'accepted', 'cancelled', 'finished'],
    default: 'open'
  },
  // Results for the team that created the scrim
  wins: {
    type: Number,
    required: false
  },
  losses: {
    type: Number,
    required: false
  },
  draws: {
    type: Number,
    required: false,
    default: 0
  },
  // Store the opposing team info for proper statistics
  opposingTeamName: {
    type: String,
    required: false
  },
  opposingTeamLeader: {
    type: String,
    required: false
  },
  opposingTeamMembers: [{
    type: String
  }],
  finishedAt: {
    type: Date,
    required: false
  },
  pendingConfirmation: {
    type: Boolean,
    default: false
  },
  confirmationData: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    resultsText: { type: String, default: '' },
    team1MatchWins: { type: Number, default: 0 },
    team1MatchLosses: { type: Number, default: 0 },
    team2MatchWins: { type: Number, default: 0 },
    team2MatchLosses: { type: Number, default: 0 },
    initiatingUserId: { type: String, default: '' }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  reminderSent: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Scrim', scrimSchema);
