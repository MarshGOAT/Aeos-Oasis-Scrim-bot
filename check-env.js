
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables with explicit path
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Environment variables check:');
console.log('BOT_TOKEN exists:', !!process.env.BOT_TOKEN);
console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

// Print first few characters of each to verify (don't print full token for security)
if (process.env.BOT_TOKEN) {
  console.log('BOT_TOKEN starts with:', process.env.BOT_TOKEN.substring(0, 10) + '...');
}
if (process.env.CLIENT_ID) {
  console.log('CLIENT_ID:', process.env.CLIENT_ID);
}
if (process.env.MONGODB_URI) {
  console.log('MONGODB_URI starts with:', process.env.MONGODB_URI.substring(0, 20) + '...');
}

console.log('Current directory:', __dirname);
console.log('Env file path:', path.join(__dirname, '.env'));
