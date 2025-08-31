const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const dotenv = require('dotenv');
const connectDB = require('./database/connection');

// Load environment variables with explicit path
dotenv.config({ path: path.join(__dirname, '.env') });

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.commands = new Collection();
client.handlers = new Collection(); // Add a collection for handlers

// Load commands and handlers
const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath).forEach(file => {
  if (!file.endsWith('.js')) return;
  
  try {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if (file.includes('_handler')) {
      // This is a handler file
      if (command.name && command.execute) {
        client.handlers.set(command.name, command);
        console.log(`Loaded handler: ${command.name}`);
      }
    } else {
      // This is a regular command file
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
      }
    }
  } catch (error) {
    console.error(`Error loading file ${file}:`, error);
  }
});

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Connect to MongoDB after Discord client is ready
  await connectDB();
  
  // Start scheduled jobs
  require('./jobs/scrimReminder');
  require('./jobs/autoDisband');
});

client.on('interactionCreate', async interaction => {
  try {
    // Check if interaction is still valid (not expired)
    if (!interaction.isRepliable()) {
      console.log('Interaction is no longer repliable (expired)');
      return;
    }

    if (interaction.isCommand()) {
      // Handle slash commands
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      
      // Execute command directly - no timeout for modal commands
      await command.execute(interaction);
    } 
    else if (interaction.isModalSubmit()) {
      // Handle modal submissions
      console.log(`Modal submission received: ${interaction.customId} from interaction ${interaction.id}`);
      if (interaction.customId === 'scrimCreateModal') {
        const command = client.commands.get('scrim_create');
        if (command) {
          console.log('Routing modal submission to scrim_create command');
          await command.execute(interaction);
        }
      }
    }
    else if (interaction.isButton()) {
      // Handle button interactions
      const customId = interaction.customId;
      
      // Extract the handler name from the customId
      let handlerName = null;
      
      if (customId.startsWith('scrimAccept_')) {
        // Route scrim accept buttons to scrim_accept command
        const command = client.commands.get('scrim_accept');
        if (command) {
          // Extract scrim ID and create fake options for the command
          const scrimId = customId.replace('scrimAccept_', '');
          interaction.options = {
            getString: (name) => name === 'scrim_id' ? scrimId : null
          };
          await command.execute(interaction);
        }
        return;
      }
      else if (customId.startsWith('scrimCancel_')) {
        // Route scrim cancel buttons to scrim_cancel command
        const command = client.commands.get('scrim_cancel');
        if (command) {
          // Extract scrim ID and create fake options for the command
          const scrimId = customId.replace('scrimCancel_', '');
          interaction.options = {
            getString: (name) => name === 'scrim_id' ? scrimId : null
          };
          await command.execute(interaction);
        }
        return;
      }
      else if (customId.startsWith('confirm_scrim_')) {
        handlerName = 'scrim_confirm_handler';
      } 
      else if (customId.startsWith('unconfirm_scrim_')) {
        handlerName = 'scrim_confirm_handler';
      }
      else if (customId.startsWith('clear_confirm_')) {
        handlerName = 'scrim_clear_handler';
      }
      else if (customId.startsWith('clear_cancel_')) {
        handlerName = 'scrim_clear_handler';
      }
      else if (customId.startsWith('team_invite_')) {
        handlerName = 'team_invite_handler';
      }
      else if (customId.startsWith('team_leave_')) {
        handlerName = 'team_leave_handler';
      }
      else if (customId.startsWith('temp_sub_')) {
        handlerName = 'temp_sub_handler';
      }
      else if (customId === 'prev' || customId === 'next') {
        // Handle help command pagination - no separate handler needed
        return;
      }
      
      if (handlerName) {
        const handler = client.handlers.get(handlerName);
        if (handler) {
          // Add timeout protection for handlers too
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Handler execution timeout')), 2500);
          });
          
          await Promise.race([
            handler.execute(interaction),
            timeoutPromise
          ]);
        }
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    
    // Only try to respond if interaction is still valid and not replied
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error while executing this command!', 
          flags: 64 // InteractionResponseFlags.Ephemeral
        });
      } else if (interaction.isRepliable() && (interaction.replied || interaction.deferred)) {
        await interaction.followUp({ 
          content: 'There was an error while executing this command!', 
          flags: 64 // InteractionResponseFlags.Ephemeral
        });
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
});

// Add error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

client.login(process.env.BOT_TOKEN);
