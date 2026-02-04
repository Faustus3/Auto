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

  // === KNOWLEDGE SEARCH (RAG) ===

  async searchKnowledge(username, query, options = {}) {
    const {
      searchNotes = true,
      searchBlogPosts = true,
      searchScripts = true,
      maxResults = 5,
      minScore = 0.1
    } = options;

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    const results = [];

    // Search notes
    if (searchNotes) {
      const keys = await this.listKeys(username);
      for (const key of keys.keys) {
        if (key.startsWith('note_')) {
          const note = await this.loadData(username, key);
          if (note) {
            const score = this.calculateRelevanceScore(queryLower, queryWords, note.title, note.content);
            if (score >= minScore) {
              results.push({
                type: 'note',
                title: note.title,
                content: note.content,
                score,
                relevance: score >= 0.5 ? 'high' : score >= 0.3 ? 'medium' : 'low'
              });
            }
          }
        }
      }
    }

    // Search blog posts
    if (searchBlogPosts) {
      const posts = await this.getSharedBlogPosts();
      for (const post of posts) {
        const searchableText = `${post.title} ${post.content} ${(post.tags || []).join(' ')}`.toLowerCase();
        const score = this.calculateRelevanceScore(queryLower, queryWords, post.title, post.content);
        if (score >= minScore) {
          results.push({
            type: 'blog',
            title: post.title,
            content: post.content,
            author: post.author,
            tags: post.tags,
            score,
            relevance: score >= 0.5 ? 'high' : score >= 0.3 ? 'medium' : 'low'
          });
        }
      }
    }

    // Search uploaded scripts/knowledge
    if (searchScripts) {
      const scripts = await this.getTheaterScripts(username);
      for (const script of scripts) {
        const fullScript = await this.getTheaterScript(username, script.filename.replace(/\.[^/.]+$/, ''));
        if (fullScript && fullScript.chunks) {
          for (let i = 0; i < fullScript.chunks.length; i++) {
            const chunk = fullScript.chunks[i];
            const chunkLower = chunk.toLowerCase();
            const score = this.calculateRelevanceScore(queryLower, queryWords, script.filename, chunk);
            if (score >= minScore) {
              results.push({
                type: 'knowledge',
                title: script.filename,
                chunkIndex: i + 1,
                content: chunk,
                score,
                relevance: score >= 0.5 ? 'high' : score >= 0.3 ? 'medium' : 'low'
              });
            }
          }
        }
      }
    }

    // Sort by score descending and limit results
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, maxResults);

    return {
      query,
      totalResults: results.length,
      returnedResults: topResults.length,
      results: topResults
    };
  }

  calculateRelevanceScore(queryLower, queryWords, title, content) {
    const titleLower = (title || '').toLowerCase();
    const contentLower = (content || '').toLowerCase();
    
    let score = 0;
    let titleMatches = 0;
    let contentMatches = 0;

    // Exact phrase match (highest weight)
    if (titleLower.includes(queryLower)) {
      score += 10;
      titleMatches += 3;
    }
    if (contentLower.includes(queryLower)) {
      score += 5;
      contentMatches += 2;
    }

    // Individual word matches
    for (const word of queryWords) {
      if (word.length < 2) continue;
      
      // Title matches (high weight)
      const titleOccurrences = (titleLower.match(new RegExp(this.escapeRegExp(word), 'g')) || []).length;
      score += titleOccurrences * 3;
      titleMatches += titleOccurrences;

      // Content matches (medium weight)
      const contentOccurrences = (contentLower.match(new RegExp(this.escapeRegExp(word), 'g')) || []).length;
      score += contentOccurrences * 1;
      contentMatches += contentOccurrences;
    }

    // Bonus for multiple words appearing together
    if (queryWords.length > 1) {
      let adjacentCount = 0;
      for (const word of queryWords) {
        if (contentLower.includes(word)) adjacentCount++;
      }
      if (adjacentCount >= queryWords.length - 1) {
        score += 5;
      }
    }

    // Normalize score
    const maxPossibleScore = queryWords.length * 3 + 10;
    return Math.min(score / maxPossibleScore, 1);
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Build RAG context from search results
  buildRagContext(searchResults) {
    if (!searchResults.results || searchResults.results.length === 0) {
      return null;
    }

    let context = '=== RELEVANT KNOWLEDGE ===\n\n';
    
    for (const result of searchResults.results) {
      const relevanceEmoji = result.relevance === 'high' ? '🟢' : result.relevance === 'medium' ? '🟡' : '⚪';
      
      context += `${relevanceEmoji} [${result.type.toUpperCase()}] ${result.title}\n`;
      
      if (result.type === 'knowledge' && result.chunkIndex) {
        context += `   (Chunk ${result.chunkIndex})\n`;
      }
      
      if (result.author) {
        context += `   Author: ${result.author}\n`;
      }
      
      context += `${result.content}\n`;
      context += '\n---\n\n';
    }

    return context;
  }
}

module.exports = DataService;