// Simple script to create a test user
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

async function createTestUser() {
  try {
    const usersFilePath = path.join(__dirname, 'data/users.json');

    // Read existing users
    let users = [];
    try {
      const usersData = await fs.readFile(usersFilePath, 'utf8');
      users = JSON.parse(usersData);
    } catch (error) {
      // File doesn't exist or is empty, that's fine
    }

    // Check if user already exists
    const existingUser = users.find(user => user.username === 'Finn');
    if (existingUser) {
      console.log('User Finn already exists');
      return;
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('test', saltRounds);

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      username: 'Finn',
      password: hashedPassword,
      displayName: 'Finn',
      createdAt: new Date().toISOString()
    };

    // Add to users array
    users.push(newUser);

    // Save users
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));

    console.log('User Finn created successfully with password "test"');
  } catch (error) {
    console.error('Error creating user:', error.message);
  }
}

createTestUser();