/**
 * Data Service
 * Handles saving and loading user data (notes, blog posts, etc.)
 */

const fs = require('fs').promises;
const path = require('path');

class DataService {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.ensureDataDir();
  }

  // Ensure the data directory exists
  async ensureDataDir() {
    try {
      await fs.access(this.dataDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  // Save data for a user
  async saveData(username, key, data) {
    try {
      const userDir = path.join(this.dataDir, username);
      await fs.access(userDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(userDir, { recursive: true });
    }

    const filePath = path.join(userDir, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    return { success: true, message: 'Daten erfolgreich gespeichert' };
  }

  // Load data for a user
  async loadData(username, key) {
    try {
      const filePath = path.join(this.dataDir, username, `${key}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid
      return null;
    }
  }

  // List all keys for a user
  async listKeys(username) {
    try {
      const userDir = path.join(this.dataDir, username);
      await fs.access(userDir);

      const files = await fs.readdir(userDir);
      const keys = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));

      return { keys };
    } catch (error) {
      // User directory doesn't exist
      return { keys: [] };
    }
  }
}

module.exports = DataService;