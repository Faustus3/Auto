/**
 * Authentication Service
 * Handles user registration, login, and token management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

class AuthService {
  constructor(jwtSecret) {
    this.jwtSecret = jwtSecret;
    this.usersFilePath = path.resolve(__dirname, '..', 'data', 'users.json');
    this.ensureUsersFile();
  }

  // Ensure the users file exists
  async ensureUsersFile() {
    try {
      await fs.access(this.usersFilePath);
    } catch (error) {
      // File doesn't exist, create it with empty array
      await fs.writeFile(this.usersFilePath, JSON.stringify([]));
    }
  }

  // Register a new user
  async register(username, password, displayName = '') {
    try {
      // Read existing users
      const users = JSON.parse(await fs.readFile(this.usersFilePath, 'utf8'));

      // Check if user already exists
      const existingUser = users.find(user => user.username === username);
      if (existingUser) {
        throw new Error('Benutzername bereits vergeben');
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create new user
      const newUser = {
        id: Date.now().toString(),
        username,
        password: hashedPassword,
        displayName: displayName || username,
        createdAt: new Date().toISOString()
      };

      // Add to users array
      users.push(newUser);

      // Save users
      await fs.writeFile(this.usersFilePath, JSON.stringify(users, null, 2));

      // Generate token
      const token = jwt.sign(
        { id: newUser.id, username: newUser.username },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      return {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.displayName
        },
        token
      };
    } catch (error) {
      throw new Error(`Registrierung fehlgeschlagen: ${error.message}`);
    }
  }

  // Login user
  async login(username, password) {
    try {
      // Read users
      const users = JSON.parse(await fs.readFile(this.usersFilePath, 'utf8'));

      // Find user
      const user = users.find(u => u.username === username);
      if (!user) {
        throw new Error('Ungültiger Benutzername oder Passwort');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Ungültiger Benutzername oder Passwort');
      }

      // Generate token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName
        },
        token
      };
    } catch (error) {
      throw new Error(`Anmeldung fehlgeschlagen: ${error.message}`);
    }
  }

  // Verify JWT token
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Zugriff verweigert: Kein Token bereitgestellt' });
    }

    jwt.verify(token, this.jwtSecret, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Ungültiger Token' });
      }
      req.user = user;
      next();
    });
  }
}

module.exports = AuthService;