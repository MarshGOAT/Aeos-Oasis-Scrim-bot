const { SlashCommandBuilder } = require('@discordjs/builders');
const Team = require('../database/models/Team');

// /team create <name>
module.exports = {
  data: new SlashCommandBuilder()
    .setName('team_create')
    .setDescription('Create a new team')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Team name')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const teamName = interaction.options.getString('name');
      const userId = interaction.user.id;
      const username = interaction.user.username;
      const guildId = interaction.guild.id;

      // Check if user is already in a team
      const existingTeam = await Team.findOne({
        $or: [
          { leader: userId },
          { 'members.userId': userId }
        ],
        guildId: guildId
      });

      if (existingTeam) {
        return await interaction.reply({ 
          content: `❌ You're already in team **${existingTeam.name}**. Leave your current team first.`, 
          ephemeral: true 
        });
      }

      // Check if team name already exists
      const existingTeamName = await Team.findOne({ 
        name: teamName, 
        guildId: guildId 
      });

      if (existingTeamName) {
        return await interaction.reply({ 
          content: `❌ Team name **${teamName}** is already taken. Choose a different name.`, 
          ephemeral: true 
        });
      }

      // Create Discord role for the team
      let teamRole;
      try {
        teamRole = await interaction.guild.roles.create({
          name: teamName,
          color: Math.floor(Math.random() * 16777215),
          reason: `Team role for ${teamName}`,
          mentionable: true
        });

        // Assign role to team leader
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.add(teamRole);
        console.log(`Successfully assigned role ${teamRole.name} to ${member.user.username}`);
      } catch (roleError) {
        console.error('Error creating team role:', roleError);
        console.error('Full role error details:', roleError.stack);
        
        // Check specific permission errors
        if (roleError.code === 50013) {
          await interaction.reply({
            content: '❌ Missing permissions! The bot needs "Manage Roles" permission and must be higher in the role hierarchy.',
            ephemeral: true
          });
        } else if (roleError.code === 50001) {
          await interaction.reply({
            content: '❌ Missing access! The bot cannot access this server or channel.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: `❌ Failed to create team role: ${roleError.message}. Please ensure the bot has proper permissions.`,
            ephemeral: true
          });
        }
        return;
      }

      // Create new team
      const newTeam = new Team({
        name: teamName,
        leader: userId,
        members: [], // Leader is not included in members array
        guildId: guildId,
        roleId: teamRole.id
      });

      await newTeam.save();

      await interaction.reply({ 
        content: `✅ Team **${teamName}** created successfully! You are the team leader.\n🎭 Team role ${teamRole} has been created and assigned to you.`, 
        ephemeral: true 
      });

    } catch (error) {
      console.error('Error creating team:', error);
      console.error('Full error details:', error.stack);
      
      // Check if it's a database connection error
      if (error.name === 'MongoNetworkError' || error.name === 'MongooseError') {
        await interaction.reply({ 
          content: '❌ Database connection error. Please check the database connection and try again.', 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: `❌ An error occurred while creating the team: ${error.message}. Please try again.`, 
          ephemeral: true 
        });
      }
    }
  }
};
