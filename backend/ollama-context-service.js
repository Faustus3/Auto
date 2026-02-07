/**
 * Ollama Context Service
 * RAG (Retrieval-Augmented Generation) implementation for Ollama
 * 
 * Features:
 * - Hybrid search (semantic + keyword)
 * - Context building from multiple sources
 * - Relevance scoring
 * - Configurable context window
 */

const DatabaseService = require('./database-service');
const VectorService = require('./vector-service');
const PromptService = require('./prompt-service');

class OllamaContextService {
  constructor() {
    this.ollamaBaseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
    this.maxContextLength = 8000; // Characters
    this.minRelevanceScore = 0.3;
  }

  /**
   * Get context for Ollama from all available sources
   * Main entry point for RAG
   * 
   * @param {string} userId - Username/user ID
   * @param {string} query - User query
   * @param {Object} options - Search options
   * @returns {string} Formatted context string
   */
  async getContextForOllama(userId, query, options = {}) {
    try {
      const {
        searchNotes = true,
        searchBlogPosts = true,
        searchFiles = true,
        searchKnowledge = true,
        maxResults = 5,
        contextWeight = 'balanced' // 'semantic', 'keyword', or 'balanced'
      } = options;

      console.log(`[OllamaContextService] Generating context for query: "${query.substring(0, 50)}..."`);

      let results = [];

      // Try semantic search first (most accurate)
      if (contextWeight === 'semantic' || contextWeight === 'balanced') {
        try {
          const semanticResults = await this.performSemanticSearch(query, {
            searchNotes,
            searchBlogPosts,
            searchKnowledge,
            maxResults: maxResults * 2
          });
          
          results = [...results, ...semanticResults.map(r => ({
            ...r,
            searchMethod: 'semantic',
            relevance: r.similarity || 0
          }))];
          
          console.log(`[OllamaContextService] Semantic search found ${semanticResults.length} results`);
        } catch (error) {
          console.warn('[OllamaContextService] Semantic search failed:', error.message);
        }
      }

      // Fallback to keyword search or supplement semantic results
      if (contextWeight === 'keyword' || contextWeight === 'balanced' || results.length < maxResults) {
        try {
          const keywordResults = await this.performKeywordSearch(userId, query, {
            searchNotes,
            searchBlogPosts,
            searchFiles,
            maxResults: maxResults * 2
          });
          
          // Merge results, avoiding duplicates
          const existingIds = new Set(results.map(r => r.id));
          const newResults = keywordResults
            .filter(r => !existingIds.has(r.id))
            .map(r => ({
              ...r,
              searchMethod: 'keyword',
              relevance: r.score || 0
            }));
          
          results = [...results, ...newResults];
          console.log(`[OllamaContextService] Keyword search found ${newResults.length} new results`);
        } catch (error) {
          console.warn('[OllamaContextService] Keyword search failed:', error.message);
        }
      }

      // Sort by relevance and limit results
      results.sort((a, b) => b.relevance - a.relevance);
      const topResults = results.slice(0, maxResults);

      if (topResults.length === 0) {
        console.log('[OllamaContextService] No relevant context found');
        return null;
      }

      // Build formatted context
      const context = this.buildContext(topResults);
      
      console.log(`[OllamaContextService] Built context with ${topResults.length} sources`);
      
      return context;

    } catch (error) {
      console.error('[OllamaContextService] Error generating context:', error.message);
      return null;
    }
  }

  /**
   * Perform semantic search using vector embeddings
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Search results
   */
  async performSemanticSearch(query, options) {
    const { searchNotes, searchBlogPosts, searchKnowledge, maxResults } = options;

    const searchOptions = {
      searchNotes,
      searchBlogPosts,
      searchKnowledge,
      maxResults
    };

    const results = await VectorService.hybridSearch(query, searchOptions);
    
    // Format results consistently
    return results.map(result => ({
      id: result.id,
      type: result.type,
      title: result.metadata?.title || result.id,
      content: result.content,
      metadata: result.metadata,
      similarity: result.similarity,
      source: this.getSourceLabel(result.type)
    }));
  }

  /**
   * Perform keyword search using database
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Search results
   */
  async performKeywordSearch(userId, query, options) {
    const { searchNotes, searchBlogPosts, searchFiles, maxResults } = options;
    const results = [];

    // Search notes
    if (searchNotes) {
      try {
        const noteResults = DatabaseService.searchNotes(userId, query, maxResults);
        results.push(...noteResults.map(note => ({
          id: `note_${note.id}`,
          type: 'note',
          title: note.title,
          content: note.content,
          metadata: { tags: note.tags },
          score: this.calculateKeywordScore(query, note.title, note.content),
          source: 'Notiz'
        })));
      } catch (error) {
        console.warn('[OllamaContextService] Note search error:', error.message);
      }
    }

    // Search blog posts
    if (searchBlogPosts) {
      try {
        const blogResults = DatabaseService.searchBlogPosts(query, maxResults);
        results.push(...blogResults.map(post => ({
          id: `blog_${post.id}`,
          type: 'blog',
          title: post.title,
          content: post.content,
          metadata: { 
            author: post.author,
            tags: post.tags 
          },
          score: this.calculateKeywordScore(query, post.title, post.content),
          source: 'Blog-Post'
        })));
      } catch (error) {
        console.warn('[OllamaContextService] Blog search error:', error.message);
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Calculate keyword relevance score
   * @param {string} query - Search query
   * @param {string} title - Content title
   * @param {string} content - Content body
   * @returns {number} Score between 0 and 1
   */
  calculateKeywordScore(query, title, content) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const titleLower = (title || '').toLowerCase();
    const contentLower = (content || '').toLowerCase();
    
    let score = 0;
    let maxScore = 10;

    // Exact phrase match (highest weight)
    if (titleLower.includes(queryLower)) {
      score += 5;
    }
    if (contentLower.includes(queryLower)) {
      score += 3;
    }

    // Individual word matches
    for (const word of queryWords) {
      // Title matches
      const titleMatches = (titleLower.match(new RegExp(this.escapeRegExp(word), 'g')) || []).length;
      score += titleMatches * 2;

      // Content matches
      const contentMatches = (contentLower.match(new RegExp(this.escapeRegExp(word), 'g')) || []).length;
      score += Math.min(contentMatches * 0.1, 1); // Cap content matches
      
      maxScore += 3;
    }

    // Bonus for multiple matching words
    if (queryWords.length > 1) {
      const matchingWords = queryWords.filter(word => 
        titleLower.includes(word) || contentLower.includes(word)
      ).length;
      
      if (matchingWords === queryWords.length) {
        score += 2; // All words match
      } else if (matchingWords >= queryWords.length * 0.5) {
        score += 1; // Majority match
      }
    }

    return Math.min(score / maxScore, 1);
  }

  /**
   * Build formatted context string from results using PromptService
   * @param {Array} results - Search results
   * @returns {string} Formatted context
   */
  buildContext(results) {
    if (!results || results.length === 0) {
      return null;
    }

    let context = '';
    let currentLength = 0;
    const includedResults = [];

    for (const result of results) {
      // Format individual result
      const formattedResult = this.formatResult(result);
      const resultLength = formattedResult.length;

      // Check if adding this would exceed context limit
      if (currentLength + resultLength > this.maxContextLength) {
        // Try to truncate content
        const availableSpace = this.maxContextLength - currentLength - 100;
        if (availableSpace > 200) {
          const truncated = this.truncateContent(result.content, availableSpace);
          const truncatedFormat = this.formatResult({ ...result, content: truncated });
          includedResults.push(truncatedFormat);
          currentLength += truncatedFormat.length;
        }
        break;
      }

      includedResults.push(formattedResult);
      currentLength += resultLength;
    }

    // Build final context using PromptService
    const contextContent = includedResults.join('\n---\n\n');
    return PromptService.buildRagPrompt(contextContent, {
      searchMethod: 'hybrid',
      resultCount: results.length
    }).content;
  }

  /**
   * Format a single result for context
   * @param {Object} result - Search result
   * @returns {string} Formatted string
   */
  formatResult(result) {
    const emoji = this.getTypeEmoji(result.type);
    const relevance = result.relevance ? Math.round(result.relevance * 100) : 'N/A';
    const searchMethod = result.searchMethod === 'semantic' ? '🔍' : '🔤';
    
    let formatted = `${emoji} [${result.source || result.type.toUpperCase()}] ${result.title}`;
    
    if (result.metadata?.author) {
      formatted += ` (von ${result.metadata.author})`;
    }
    
    formatted += ` ${searchMethod} Relevanz: ${relevance}%\n\n`;
    
    // Clean and limit content
    const cleanContent = this.cleanContent(result.content);
    formatted += cleanContent;
    
    return formatted;
  }

  /**
   * Clean content for context
   * @param {string} content - Raw content
   * @returns {string} Cleaned content
   */
  cleanContent(content) {
    if (!content) return '';
    
    return content
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
      .trim();
  }

  /**
   * Truncate content to fit available space
   * @param {string} content - Full content
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated content
   */
  truncateContent(content, maxLength) {
    if (!content || content.length <= maxLength) {
      return content;
    }

    // Try to truncate at a sentence boundary
    const truncated = content.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n\n');
    
    const truncateAt = Math.max(lastPeriod, lastNewline);
    
    if (truncateAt > maxLength * 0.5) {
      return truncated.substring(0, truncateAt + 1) + '\n\n[... Inhalt gekürzt ...]';
    }
    
    return truncated + '\n\n[... Inhalt gekürzt ...]';
  }

  /**
   * Get emoji for content type
   * @param {string} type - Content type
   * @returns {string} Emoji
   */
  getTypeEmoji(type) {
    const emojis = {
      note: '📝',
      blog: '📰',
      knowledge: '📚',
      file: '📎'
    };
    return emojis[type] || '📄';
  }

  /**
   * Get source label
   * @param {string} type - Content type
   * @returns {string} Label
   */
  getSourceLabel(type) {
    const labels = {
      note: 'Notiz',
      blog: 'Blog-Post',
      knowledge: 'Wissensdatenbank',
      file: 'Datei'
    };
    return labels[type] || type;
  }

  /**
   * Escape special regex characters
   * @param {string} string - Input string
   * @returns {string} Escaped string
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Quick context query for simple use cases
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @returns {string|null} Context or null
   */
  async quickContext(userId, query) {
    return this.getContextForOllama(userId, query, {
      searchNotes: true,
      searchBlogPosts: true,
      searchFiles: false,
      searchKnowledge: true,
      maxResults: 3,
      contextWeight: 'balanced'
    });
  }
}

// Export singleton instance
module.exports = new OllamaContextService();
