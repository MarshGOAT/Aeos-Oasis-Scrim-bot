const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  leader: {
    type: String, // Discord user ID
    required: true
  },
  members: [{
    userId: {
      type: String, // Discord user ID
      required: true
    },
    username: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isTemporary: {
      type: Boolean,
      default: false
    },
    scrimId: {
      type: String,
      required: false
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  guildId: {
    type: String, // Discord guild/server ID
    required: true
  },
  roleId: {
    type: String, // Discord role ID
    required: false
  },
  matchesWon: {
    type: Number,
    default: 0
  },
  matchesLost: {
    type: Number,
    default: 0
  },
  scrimsWon: {
    type: Number,
    default: 0
  },
  scrimsLost: {
    type: Number,
    default: 0
  },
  scrimsDrawn: {
    type: Number,
    default: 0
  },
  // Legacy fields for backward compatibility
  wins: {
    type: Number,
    default: 0
  },
  losses: {
    type: Number,
    default: 0
  },
  pendingInvites: [{
    inviteId: String,
    userId: String,
    username: String,
    invitedBy: String,
    invitedAt: Date,
    guildId: String
  }],
  pendingTempSubs: [{
    inviteId: String,
    userId: String,
    username: String,
    invitedBy: String,
    invitedAt: Date,
    guildId: String,
    scrimId: String
  }],
  activeTempSubs: [{
    userId: String,
    username: String,
    scrimId: String,
    joinedAt: Date
  }]
});

// Index for faster queries
teamSchema.index({ leader: 1 });
teamSchema.index({ 'members.userId': 1 });
teamSchema.index({ guildId: 1 });

module.exports = mongoose.model('Team', teamSchema);
