/**
 * Database Service
 * Robust SQLite storage for notes and blog posts using Node.js 22+ built-in sqlite
 * 
 * Features:
 * - Built-in Node.js 22+ sqlite module (no native dependencies)
 * - ACID transactions for data integrity
 * - Prepared statements for SQL injection protection
 * - Full-text search support
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    this.dbPath = path.resolve(__dirname, '..', 'data', 'app.db');
    this.db = null;
    this.statements = {};
    this.initialized = false;
    
    this.init();
  }

  /**
   * Initialize database connection and schema
   */
  init() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Open database
      this.db = new DatabaseSync(this.dbPath);
      
      // Enable foreign keys and WAL mode
      this.db.exec('PRAGMA foreign_keys = ON');
      this.db.exec('PRAGMA journal_mode = WAL');

      // Create tables
      this.createSchema();
      
      // Prepare statements for common operations
      this.prepareStatements();
      
      this.initialized = true;
      console.log('[DatabaseService] SQLite initialized successfully at:', this.dbPath);
    } catch (error) {
      console.error('[DatabaseService] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Create database schema with indexes
   */
  createSchema() {
    // Notes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)
    `);
    
    // Blog posts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        author_display_name TEXT,
        tags TEXT,
        is_public INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_blog_author ON blog_posts(author)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_blog_created ON blog_posts(created_at DESC)
    `);

    // Files table for uploaded documents
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC)
    `);
  }

  /**
   * Prepare SQL statements for better performance
   */
  prepareStatements() {
    // Notes statements
    this.statements.createNote = this.db.prepare(`
      INSERT INTO notes (user_id, title, content, tags)
      VALUES (?, ?, ?, ?)
    `);
    
    this.statements.getNoteById = this.db.prepare(`
      SELECT * FROM notes WHERE id = ? AND user_id = ?
    `);
    
    this.statements.getNotesByUser = this.db.prepare(`
      SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?
    `);
    
    this.statements.updateNote = this.db.prepare(`
      UPDATE notes 
      SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);
    
    this.statements.deleteNote = this.db.prepare(`
      DELETE FROM notes WHERE id = ? AND user_id = ?
    `);
    
    // Blog posts statements
    this.statements.createBlogPost = this.db.prepare(`
      INSERT INTO blog_posts (title, content, author, author_display_name, tags, is_public)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    this.statements.getBlogPostById = this.db.prepare(`
      SELECT * FROM blog_posts WHERE id = ?
    `);
    
    this.statements.getAllBlogPosts = this.db.prepare(`
      SELECT * FROM blog_posts WHERE is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?
    `);
    
    this.statements.updateBlogPost = this.db.prepare(`
      UPDATE blog_posts 
      SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND author = ?
    `);
    
    this.statements.deleteBlogPost = this.db.prepare(`
      DELETE FROM blog_posts WHERE id = ? AND author = ?
    `);
    
    // File statements
    this.statements.createFile = this.db.prepare(`
      INSERT INTO files (user_id, original_name, stored_name, file_path, mime_type, file_size, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    this.statements.getFileById = this.db.prepare(`
      SELECT * FROM files WHERE id = ? AND user_id = ?
    `);
    
    this.statements.getFilesByUser = this.db.prepare(`
      SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC
    `);
    
    this.statements.deleteFile = this.db.prepare(`
      DELETE FROM files WHERE id = ? AND user_id = ?
    `);
    
    // Search statements
    this.statements.searchNotes = this.db.prepare(`
      SELECT * FROM notes 
      WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    
    this.statements.searchBlogPosts = this.db.prepare(`
      SELECT * FROM blog_posts 
      WHERE is_public = 1 AND (title LIKE ? OR content LIKE ?)
      ORDER BY created_at DESC
      LIMIT ?
    `);
  }

  // === NOTES CRUD OPERATIONS ===

  createNote(userId, { title, content, tags = [] }) {
    this.validateNoteData(title, content);
    
    const info = this.statements.createNote.run(
      userId,
      title.trim(),
      content.trim(),
      JSON.stringify(tags)
    );
    
    const result = this.statements.getNoteById.get(info.lastInsertRowid, userId);
    return this.formatNote(result);
  }

  getNoteById(userId, noteId) {
    const result = this.statements.getNoteById.get(noteId, userId);
    return result ? this.formatNote(result) : null;
  }

  getNotesByUser(userId, { limit = 50, offset = 0 } = {}) {
    const notes = this.statements.getNotesByUser.all(userId, limit, offset);
    
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?');
    const { count } = countStmt.get(userId);
    
    return {
      notes: notes.map(n => this.formatNote(n)),
      total: count,
      limit,
      offset
    };
  }

  updateNote(userId, noteId, { title, content, tags }) {
    const existing = this.getNoteById(userId, noteId);
    if (!existing) {
      throw new Error('Note not found');
    }
    
    const updates = [
      title !== undefined ? title.trim() : existing.title,
      content !== undefined ? content.trim() : existing.content,
      tags !== undefined ? JSON.stringify(tags) : JSON.stringify(existing.tags),
      noteId,
      userId
    ];
    
    this.statements.updateNote.run(...updates);
    return this.getNoteById(userId, noteId);
  }

  deleteNote(userId, noteId) {
    const result = this.statements.deleteNote.run(noteId, userId);
    
    if (result.changes === 0) {
      throw new Error('Note not found');
    }
    
    return true;
  }

  searchNotes(userId, query, limit = 20) {
    const searchPattern = `%${query}%`;
    const results = this.statements.searchNotes.all(userId, searchPattern, searchPattern, limit);
    return results.map(r => this.formatNote(r));
  }

  // === BLOG POSTS CRUD OPERATIONS ===

  createBlogPost({ title, content, author, authorDisplayName, tags = [], isPublic = true }) {
    this.validateBlogData(title, content);
    
    const info = this.statements.createBlogPost.run(
      title.trim(),
      content.trim(),
      author,
      authorDisplayName || author,
      JSON.stringify(tags),
      isPublic ? 1 : 0
    );
    
    const result = this.statements.getBlogPostById.get(info.lastInsertRowid);
    return this.formatBlogPost(result);
  }

  getBlogPostById(postId) {
    const result = this.statements.getBlogPostById.get(postId);
    return result ? this.formatBlogPost(result) : null;
  }

  getAllBlogPosts({ limit = 50, offset = 0 } = {}) {
    const posts = this.statements.getAllBlogPosts.all(limit, offset);
    
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM blog_posts WHERE is_public = 1');
    const { count } = countStmt.get();
    
    return {
      posts: posts.map(p => this.formatBlogPost(p)),
      total: count,
      limit,
      offset
    };
  }

  updateBlogPost(author, postId, { title, content, tags }) {
    const existing = this.getBlogPostById(postId);
    if (!existing) {
      throw new Error('Post not found');
    }
    
    if (existing.author !== author) {
      throw new Error('Unauthorized: Only the author can update this post');
    }
    
    const updates = [
      title !== undefined ? title.trim() : existing.title,
      content !== undefined ? content.trim() : existing.content,
      tags !== undefined ? JSON.stringify(tags) : JSON.stringify(existing.tags),
      postId,
      author
    ];
    
    this.statements.updateBlogPost.run(...updates);
    return this.getBlogPostById(postId);
  }

  deleteBlogPost(author, postId) {
    const result = this.statements.deleteBlogPost.run(postId, author);
    
    if (result.changes === 0) {
      throw new Error('Post not found or unauthorized');
    }
    
    return true;
  }

  searchBlogPosts(query, limit = 20) {
    const searchPattern = `%${query}%`;
    const results = this.statements.searchBlogPosts.all(searchPattern, searchPattern, limit);
    return results.map(r => this.formatBlogPost(r));
  }

  // === FILES OPERATIONS ===

  createFile(userId, { originalName, storedName, filePath, mimeType, fileSize, description }) {
    this.validateFileData(originalName, mimeType, fileSize);
    
    const info = this.statements.createFile.run(
      userId,
      originalName,
      storedName,
      filePath,
      mimeType,
      fileSize,
      description || null
    );
    
    const result = this.statements.getFileById.get(info.lastInsertRowid, userId);
    return this.formatFile(result);
  }

  getFileById(userId, fileId) {
    const result = this.statements.getFileById.get(fileId, userId);
    return result ? this.formatFile(result) : null;
  }

  getFilesByUser(userId) {
    const results = this.statements.getFilesByUser.all(userId);
    return results.map(r => this.formatFile(r));
  }

  deleteFile(userId, fileId) {
    const result = this.statements.deleteFile.run(fileId, userId);
    
    if (result.changes === 0) {
      throw new Error('File not found');
    }
    
    return true;
  }

  // === VALIDATION HELPERS ===

  validateNoteData(title, content) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('Note title is required');
    }
    if (title.trim().length > 200) {
      throw new Error('Note title must be less than 200 characters');
    }
    if (!content || typeof content !== 'string') {
      throw new Error('Note content is required');
    }
    if (content.length > 50000) {
      throw new Error('Note content must be less than 50000 characters');
    }
  }

  validateBlogData(title, content) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('Blog post title is required');
    }
    if (title.trim().length > 200) {
      throw new Error('Blog post title must be less than 200 characters');
    }
    if (!content || typeof content !== 'string') {
      throw new Error('Blog post content is required');
    }
    if (content.length > 100000) {
      throw new Error('Blog post content must be less than 100000 characters');
    }
  }

  validateFileData(originalName, mimeType, fileSize) {
    if (!originalName || typeof originalName !== 'string') {
      throw new Error('Original filename is required');
    }
    if (!mimeType || typeof mimeType !== 'string') {
      throw new Error('MIME type is required');
    }
    if (typeof fileSize !== 'number' || fileSize < 0) {
      throw new Error('File size must be a positive number');
    }
    if (fileSize > 100 * 1024 * 1024) {
      throw new Error('File size exceeds 100MB limit');
    }
  }

  // === FORMATTING HELPERS ===

  formatNote(row) {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  formatBlogPost(row) {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      author: row.author,
      authorDisplayName: row.author_display_name,
      tags: JSON.parse(row.tags || '[]'),
      isPublic: Boolean(row.is_public),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  formatFile(row) {
    return {
      id: row.id,
      userId: row.user_id,
      originalName: row.original_name,
      storedName: row.stored_name,
      filePath: row.file_path,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      description: row.description,
      createdAt: row.created_at
    };
  }

  // === DATABASE HEALTH ===

  getStats() {
    const noteCount = this.db.prepare('SELECT COUNT(*) as count FROM notes').get();
    const blogCount = this.db.prepare('SELECT COUNT(*) as count FROM blog_posts').get();
    const fileCount = this.db.prepare('SELECT COUNT(*) as count FROM files').get();
    
    return {
      notes: noteCount.count,
      blogPosts: blogCount.count,
      files: fileCount.count,
      databasePath: this.dbPath
    };
  }

  close() {
    if (this.db) {
      this.db.close();
      console.log('[DatabaseService] Database connection closed');
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();
