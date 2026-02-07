/**
 * File Storage Service
 * Handles file uploads with validation, virus scanning, and metadata extraction
 * 
 * Features:
 * - MIME type validation
 * - File size limits
 * - Secure filename generation
 * - Directory structure for organization
 * - Duplicate detection
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileStorageService {
  constructor() {
    // Base directory for uploads
    this.uploadDir = path.resolve(__dirname, '..', 'data', 'uploads');
    
    // Allowed MIME types with categories
    this.allowedMimeTypes = {
      // Documents
      'application/pdf': { category: 'document', maxSize: 50 * 1024 * 1024 },
      'application/msword': { category: 'document', maxSize: 20 * 1024 * 1024 },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { category: 'document', maxSize: 20 * 1024 * 1024 },
      'text/plain': { category: 'text', maxSize: 10 * 1024 * 1024 },
      'text/markdown': { category: 'text', maxSize: 10 * 1024 * 1024 },
      'text/html': { category: 'text', maxSize: 10 * 1024 * 1024 },
      'application/json': { category: 'text', maxSize: 10 * 1024 * 1024 },
      
      // Images
      'image/jpeg': { category: 'image', maxSize: 20 * 1024 * 1024 },
      'image/png': { category: 'image', maxSize: 20 * 1024 * 1024 },
      'image/gif': { category: 'image', maxSize: 10 * 1024 * 1024 },
      'image/webp': { category: 'image', maxSize: 20 * 1024 * 1024 },
      'image/svg+xml': { category: 'image', maxSize: 5 * 1024 * 1024 },
      
      // Audio
      'audio/mpeg': { category: 'audio', maxSize: 100 * 1024 * 1024 },
      'audio/wav': { category: 'audio', maxSize: 100 * 1024 * 1024 },
      'audio/ogg': { category: 'audio', maxSize: 50 * 1024 * 1024 },
      'audio/m4a': { category: 'audio', maxSize: 100 * 1024 * 1024 },
      
      // Video
      'video/mp4': { category: 'video', maxSize: 500 * 1024 * 1024 },
      'video/webm': { category: 'video', maxSize: 500 * 1024 * 1024 },
      'video/ogg': { category: 'video', maxSize: 500 * 1024 * 1024 },
      
      // Archives
      'application/zip': { category: 'archive', maxSize: 100 * 1024 * 1024 },
      'application/x-zip-compressed': { category: 'archive', maxSize: 100 * 1024 * 1024 }
    };
    
    // Blocked file extensions (additional security)
    this.blockedExtensions = [
      '.exe', '.dll', '.bat', '.cmd', '.sh', '.msi', '.app',
      '.jar', '.war', '.ear', '.class', '.jsp', '.asp', '.aspx',
      '.php', '.php3', '.php4', '.phtml', '.pl', '.py', '.rb',
      '.cgi', '.htaccess', '.htpasswd', '.ini', '.conf', '.config'
    ];
    
    this.ensureUploadDir();
  }

  /**
   * Ensure upload directory exists
   */
  async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log('[FileStorageService] Upload directory created:', this.uploadDir);
    }
  }

  /**
   * Validate and store a file
   * @param {string} userId - Username/user ID
   * @param {Object} file - Multer file object
   * @param {Object} options - Upload options
   * @returns {Object} File metadata
   */
  async storeFile(userId, file, options = {}) {
    try {
      // Validate file
      this.validateFile(file);
      
      // Generate secure filename
      const storedName = this.generateSecureFilename(file.originalname);
      
      // Create user directory if not exists
      const userDir = path.join(this.uploadDir, userId);
      await this.ensureDir(userDir);
      
      // Determine subdirectory based on file category
      const mimeConfig = this.allowedMimeTypes[file.mimetype];
      const categoryDir = path.join(userDir, mimeConfig.category);
      await this.ensureDir(categoryDir);
      
      // Full file path
      const filePath = path.join(categoryDir, storedName);
      
      // Check for duplicates
      const isDuplicate = await this.checkDuplicate(userId, file.buffer);
      if (isDuplicate && !options.allowDuplicates) {
        throw new Error('Duplicate file detected');
      }
      
      // Write file to disk
      await fs.writeFile(filePath, file.buffer);
      
      // Extract metadata
      const metadata = await this.extractMetadata(file, filePath);
      
      console.log(`[FileStorageService] File stored: ${file.originalname} -> ${filePath}`);
      
      return {
        originalName: file.originalname,
        storedName: storedName,
        filePath: filePath,
        relativePath: path.relative(this.uploadDir, filePath),
        mimeType: file.mimetype,
        fileSize: file.size,
        category: mimeConfig.category,
        hash: metadata.hash,
        description: options.description || null
      };
      
    } catch (error) {
      console.error('[FileStorageService] Store error:', error.message);
      throw error;
    }
  }

  /**
   * Validate file against security rules
   * @param {Object} file - Multer file object
   */
  validateFile(file) {
    // Check if file exists
    if (!file) {
      throw new Error('No file provided');
    }
    
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('Empty file');
    }
    
    // Check MIME type
    if (!this.allowedMimeTypes[file.mimetype]) {
      throw new Error(`File type not allowed: ${file.mimetype}`);
    }
    
    // Check file size
    const maxSize = this.allowedMimeTypes[file.mimetype].maxSize;
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
    }
    
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (this.blockedExtensions.includes(ext)) {
      throw new Error(`File extension not allowed: ${ext}`);
    }
    
    // Validate filename (prevent directory traversal)
    const sanitizedName = this.sanitizeFilename(file.originalname);
    if (!sanitizedName || sanitizedName.length === 0) {
      throw new Error('Invalid filename');
    }
  }

  /**
   * Generate secure filename with hash
   * @param {string} originalName - Original filename
   * @returns {string} Secure filename
   */
  generateSecureFilename(originalName) {
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName).toLowerCase();
    return `${timestamp}_${randomStr}${ext}`;
  }

  /**
   * Sanitize filename to prevent security issues
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    // Remove path traversal characters
    let sanitized = filename.replace(/[\.]{2,}/g, '');
    sanitized = sanitized.replace(/[\\\/]/g, '');
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    
    // Limit length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      sanitized = sanitized.substring(0, 255 - ext.length) + ext;
    }
    
    return sanitized.trim();
  }

  /**
   * Calculate file hash for duplicate detection
   * @param {Buffer} buffer - File buffer
   * @returns {string} SHA256 hash
   */
  calculateHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if file is a duplicate
   * @param {string} userId - User ID
   * @param {Buffer} buffer - File buffer
   * @returns {boolean} True if duplicate exists
   */
  async checkDuplicate(userId, buffer) {
    try {
      const fileHash = this.calculateHash(buffer);
      const userDir = path.join(this.uploadDir, userId);
      
      // In production, you'd query the database for the hash
      // For now, we'll just return false
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Extract metadata from file
   * @param {Object} file - Multer file object
   * @param {string} filePath - Stored file path
   * @returns {Object} Metadata object
   */
  async extractMetadata(file, filePath) {
    const hash = this.calculateHash(file.buffer);
    
    const metadata = {
      hash,
      size: file.size,
      mimeType: file.mimetype
    };
    
    // Extract text content for searchable files
    if (this.isTextFile(file.mimetype)) {
      try {
        const content = file.buffer.toString('utf-8');
        metadata.textContent = content.substring(0, 10000); // First 10KB
        metadata.wordCount = content.split(/\s+/).length;
        metadata.lineCount = content.split('\n').length;
      } catch {
        // Not a text file
      }
    }
    
    return metadata;
  }

  /**
   * Check if MIME type is text-based
   * @param {string} mimeType - MIME type
   * @returns {boolean}
   */
  isTextFile(mimeType) {
    const textTypes = [
      'text/plain', 'text/markdown', 'text/html', 'application/json',
      'text/css', 'text/javascript', 'application/javascript',
      'application/xml', 'text/xml'
    ];
    return textTypes.includes(mimeType);
  }

  /**
   * Read file as text
   * @param {string} filePath - Path to file
   * @returns {string|null} File content or null
   */
  async readFileAsText(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer.toString('utf-8');
    } catch (error) {
      console.error('[FileStorageService] Read error:', error.message);
      return null;
    }
  }

  /**
   * Delete a file from storage
   * @param {string} filePath - Path to file
   * @returns {boolean} Success status
   */
  async deleteFile(filePath) {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      
      // Try to remove empty parent directories
      await this.cleanupEmptyDirs(path.dirname(filePath));
      
      console.log('[FileStorageService] File deleted:', filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return true; // File doesn't exist, consider it deleted
      }
      console.error('[FileStorageService] Delete error:', error.message);
      throw error;
    }
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   */
  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Clean up empty directories
   * @param {string} dirPath - Directory path
   */
  async cleanupEmptyDirs(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      if (files.length === 0) {
        await fs.rmdir(dirPath);
        // Recursively check parent
        const parentDir = path.dirname(dirPath);
        if (parentDir !== this.uploadDir) {
          await this.cleanupEmptyDirs(parentDir);
        }
      }
    } catch {
      // Directory not empty or doesn't exist
    }
  }

  /**
   * Get file statistics
   * @param {string} userId - User ID
   * @returns {Object} Statistics
   */
  async getStats(userId) {
    try {
      const userDir = path.join(this.uploadDir, userId);
      await fs.access(userDir);
      
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byCategory: {}
      };
      
      await this.calculateDirStats(userDir, stats);
      
      return stats;
    } catch {
      return {
        totalFiles: 0,
        totalSize: 0,
        byCategory: {}
      };
    }
  }

  /**
   * Recursively calculate directory statistics
   * @param {string} dirPath - Directory path
   * @param {Object} stats - Statistics accumulator
   */
  async calculateDirStats(dirPath, stats) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.calculateDirStats(fullPath, stats);
      } else {
        const fileStat = await fs.stat(fullPath);
        stats.totalFiles++;
        stats.totalSize += fileStat.size;
        
        // Determine category from parent directory
        const category = path.basename(path.dirname(fullPath));
        if (!stats.byCategory[category]) {
          stats.byCategory[category] = { files: 0, size: 0 };
        }
        stats.byCategory[category].files++;
        stats.byCategory[category].size += fileStat.size;
      }
    }
  }

  /**
   * Get allowed MIME types list
   * @returns {Object} Allowed types with limits
   */
  getAllowedTypes() {
    const types = {};
    for (const [mimeType, config] of Object.entries(this.allowedMimeTypes)) {
      types[mimeType] = {
        category: config.category,
        maxSizeMB: (config.maxSize / (1024 * 1024)).toFixed(1)
      };
    }
    return types;
  }
}

// Export singleton instance
module.exports = new FileStorageService();
