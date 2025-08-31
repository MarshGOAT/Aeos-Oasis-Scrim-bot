
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Fix the dotenv configuration to use explicit path
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./database/connection');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.commands = new Collection();

// Load commands
const ds = path.join(__dirname, 'commands');
fs.readdirSync(ds).forEach(file => {
  if (file.endsWith('.js')) {
    const command = require(path.join(ds, file));
    // Use command.data.name if available, else fallback to command.name
    const commandName = command.data?.name || command.name;
    if (commandName) {
      client.commands.set(commandName, command);
    }
  }
});

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  // Initialize MongoDB connection
  await connectDB();
  
  // Start scrim reminder job - check every 5 minutes
  const { sendScrimReminders } = require('./jobs/scrimReminder');
  setInterval(() => {
    sendScrimReminders(client);
  }, 5 * 60 * 1000); // Check every 5 minutes
  
  console.log('Scrim reminder system started');
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      
      await command.execute(interaction);
    } else if (interaction.isButton()) {
      const customId = interaction.customId;
      
      if (customId.startsWith('confirm_scrim_') || 
          customId.startsWith('unconfirm_scrim_') ||
          customId.startsWith('scrim_finish_')) {
        const handler = client.commands.get('scrim_confirm_handler');
        if (handler) {
          await handler.execute(interaction);
        }
      } else if (customId.startsWith('scrimAccept_') || customId.startsWith('cancelScrim_')) {
        const handler = client.commands.get('scrim_create');
        if (handler) {
          await handler.execute(interaction);
        }
      } else if (customId.startsWith('teamInviteAccept_') || customId.startsWith('teamInviteDecline_')) {
        const teamInviteHandler = require('./commands/team_invite_handler');
        await teamInviteHandler.execute(interaction);
      } else if (customId.startsWith('tempSubAccept_') || customId.startsWith('tempSubDecline_')) {
        const tempSubHandler = require('./commands/temp_sub_handler');
        await tempSubHandler.execute(interaction);
      } else if (customId.startsWith('teamLeave_confirm_') || customId.startsWith('teamLeave_cancel_')) {
        const teamLeaveHandler = require('./commands/team_leave_handler');
        await teamLeaveHandler.execute(interaction);
      } else if (customId.startsWith('clear_confirm_') || customId.startsWith('clear_cancel_')) {
        const clearHandler = require('./commands/scrim_clear_handler');
        await clearHandler.execute(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'scrimCreateModal') {
        const command = client.commands.get('scrim_create');
        if (command) {
          await command.execute(interaction);
        }
      }
    }
  } catch (error) {
    console.error('Error in interaction handler:', error);
  }
});

// Add error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

client.login(process.env.BOT_TOKEN); // Use environment variable for token
