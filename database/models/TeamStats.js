const mongoose = require('mongoose');

const teamStatsSchema = new mongoose.Schema({
  teamName: {
    type: String,
    required: true
  },
  guildId: {
    type: String,
    required: true
  },
  totalScrims: {
    type: Number,
    default: 0
  },
  wins: {
    type: Number,
    default: 0
  },
  losses: {
    type: Number,
    default: 0
  },
  draws: {
    type: Number,
    default: 0
  },
  gamesWon: {
    type: Number,
    default: 0
  },
  gamesLost: {
    type: Number,
    default: 0
  },
  gamesDrawn: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure one stats record per team per guild
teamStatsSchema.index({ teamName: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('TeamStats', teamStatsSchema);
