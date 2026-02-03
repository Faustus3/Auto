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

  // === SHARED BLOG POSTS ===

  async getSharedBlogPosts() {
    try {
      const blogFile = path.join(this.dataDir, 'shared', 'blog_posts.json');
      await fs.access(blogFile);
      const data = await fs.readFile(blogFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async saveSharedBlogPosts(posts) {
    const sharedDir = path.join(this.dataDir, 'shared');
    try {
      await fs.access(sharedDir);
    } catch {
      await fs.mkdir(sharedDir, { recursive: true });
    }
    const blogFile = path.join(sharedDir, 'blog_posts.json');
    await fs.writeFile(blogFile, JSON.stringify(posts, null, 2));
    return { success: true };
  }

  async addSharedBlogPost(post) {
    const posts = await this.getSharedBlogPosts();
    posts.unshift(post);
    await this.saveSharedBlogPosts(posts);
    return post;
  }

  async updateSharedBlogPost(id, updatedPost) {
    const posts = await this.getSharedBlogPosts();
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Post not found');
    posts[index] = { ...posts[index], ...updatedPost };
    await this.saveSharedBlogPosts(posts);
    return posts[index];
  }

  async deleteSharedBlogPost(id) {
    const posts = await this.getSharedBlogPosts();
    const filtered = posts.filter(p => p.id !== id);
    await this.saveSharedBlogPosts(filtered);
    return { success: true };
  }

  // === THEATER SCRIPTS ===

  async saveTheaterScript(username, filename, content) {
    const scriptsDir = path.join(this.dataDir, 'scripts', username);
    try {
      await fs.access(scriptsDir);
    } catch {
      await fs.mkdir(scriptsDir, { recursive: true });
    }

    const filePath = path.join(scriptsDir, `${filename}.json`);
    
    // Split content into ~1000 character chunks
    const chunkSize = 1000;
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize));
    }

    const scriptData = {
      filename: filename,
      originalContent: content,
      chunks: chunks,
      chunkCount: chunks.length,
      uploadedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(scriptData, null, 2));
    return { success: true, chunkCount: chunks.length, message: `Script saved with ${chunks.length} chunks` };
  }

  async getTheaterScripts(username) {
    const scriptsDir = path.join(this.dataDir, 'scripts', username);
    try {
      await fs.access(scriptsDir);
      const files = await fs.readdir(scriptsDir);
      const scripts = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(async file => {
            const filePath = path.join(scriptsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(data);
            return {
              filename: parsed.filename,
              chunkCount: parsed.chunkCount,
              uploadedAt: parsed.uploadedAt
            };
          })
      );
      return scripts;
    } catch (error) {
      return [];
    }
  }

  async getTheaterScript(username, filename) {
    const filePath = path.join(this.dataDir, 'scripts', username, `${filename}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
}

module.exports = DataService;