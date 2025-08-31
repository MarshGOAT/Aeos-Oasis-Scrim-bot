
const fs = require('fs');
const path = require('path');

const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
  console.error(`Commands directory not found: ${commandsPath}`);
  process.exit(1);
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log(`Found ${commandFiles.length} command files`);

for (const file of commandFiles) {
  try {
    const filePath = path.join(commandsPath, file);
    console.log(`\nValidating: ${file}`);
    
    const command = require(filePath);
    
    // Check if command exists
    if (!command) {
      console.error(`  ❌ Command object is null or undefined`);
      continue;
    }
    
    // Check for data property
    if (!('data' in command)) {
      console.error(`  ❌ Missing 'data' property`);
    } else {
      console.log(`  ✓ Has 'data' property`);
      
      // Check for name in data
      if (!command.data.name) {
        console.error(`  ❌ Missing 'data.name' property`);
      } else {
        console.log(`  ✓ Command name: ${command.data.name}`);
      }
    }
    
    // Check for execute function
    if (!('execute' in command)) {
      console.error(`  ❌ Missing 'execute' property`);
    } else if (typeof command.execute !== 'function') {
      console.error(`  ❌ 'execute' is not a function`);
    } else {
      console.log(`  ✓ Has 'execute' function`);
    }
    
  } catch (error) {
    console.error(`Error validating command file ${file}:`, error);
  }
}
