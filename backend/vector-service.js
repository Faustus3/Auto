/**
 * Vector Service
 * Hybrid RAG using ChromaDB for storage + Ollama for embeddings
 */

const { ChromaClient } = require('chromadb');
const path = require('path');

class VectorService {
  constructor() {
    this.client = null;
    this.ollamaBaseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      const chromaDir = path.resolve(__dirname, '..', 'data', 'chroma');
      this.client = new ChromaClient({ path: chromaDir });
      
      // Create collections for different content types
      await this.ensureCollections();
      
      this.initialized = true;
      console.log('[VectorService] ChromaDB initialized successfully');
    } catch (error) {
      console.error('[VectorService] Failed to initialize:', error.message);
      // Continue without vector search if ChromaDB fails
    }
  }

  async ensureCollections() {
    if (!this.client) return;

    const collections = [
      { name: 'notes', metadata: { description: 'User notes' } },
      { name: 'blog_posts', metadata: { description: 'Blog posts' } },
      { name: 'knowledge', metadata: { description: 'Uploaded knowledge files' } }
    ];

    for (const col of collections) {
      try {
        await this.client.getOrCreateCollection(col);
      } catch (error) {
        // Collection might already exist
      }
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('[VectorService] Embedding generation failed:', error.message);
      return null;
    }
  }

  async addDocument(collectionName, id, text, metadata = {}) {
    if (!this.initialized || !this.client) return { success: false, error: 'Not initialized' };

    try {
      const embedding = await this.generateEmbedding(text);
      if (!embedding) {
        return { success: false, error: 'Failed to generate embedding' };
      }

      const collection = await this.client.getOrCreateCollection({ name: collectionName });
      
      await collection.add({
        ids: [id],
        embeddings: [embedding],
        documents: [text],
        metadatas: [{
          ...metadata,
          indexedAt: new Date().toISOString()
        }]
      });

      return { success: true, id };
    } catch (error) {
      console.error(`[VectorService] Failed to add document to ${collectionName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async search(collectionName, query, options = {}) {
    if (!this.initialized || !this.client) {
      return { results: [], error: 'Vector service not initialized' };
    }

    try {
      const { nResults = 5, filter = {} } = options;

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return { results: [], error: 'Failed to generate query embedding' };
      }

      const collection = await this.client.getOrCreateCollection({ name: collectionName });

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        where: Object.keys(filter).length > 0 ? filter : undefined
      });

      // Format results
      const formattedResults = [];
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          formattedResults.push({
            id: results.ids[0][i],
            content: results.documents[0][i],
            metadata: results.metadatas[0][i],
            distance: results.distances?.[0]?.[i],
            similarity: results.distances?.[0]?.[i] ? 1 - results.distances[0][i] : null
          });
        }
      }

      return { results: formattedResults };
    } catch (error) {
      console.error(`[VectorService] Search failed in ${collectionName}:`, error.message);
      return { results: [], error: error.message };
    }
  }

  async deleteDocument(collectionName, id) {
    if (!this.initialized || !this.client) return { success: false };

    try {
      const collection = await this.client.getOrCreateCollection({ name: collectionName });
      await collection.delete({ ids: [id] });
      return { success: true };
    } catch (error) {
      console.error(`[VectorService] Failed to delete document:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async deleteCollection(collectionName) {
    if (!this.initialized || !this.client) return { success: false };

    try {
      const collection = await this.client.getOrCreateCollection({ name: collectionName });
      await collection.delete({ where: {} });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // === CONTENT INDEXING HELPERS ===

  async indexNote(username, noteId, title, content) {
    const id = `${username}_note_${noteId}`;
    const text = `Title: ${title}\n\nContent: ${content}`;
    const metadata = { username, noteId, title };
    
    return this.addDocument('notes', id, text, metadata);
  }

  async indexBlogPost(post) {
    const id = `blog_${post.id}`;
    const text = `Title: ${post.title}\n\nContent: ${post.content}\n\nTags: ${(post.tags || []).join(', ')}`;
    const metadata = { 
      postId: post.id, 
      author: post.author,
      title: post.title,
      tags: JSON.stringify(post.tags || [])
    };
    
    return this.addDocument('blog_posts', id, text, metadata);
  }

  async indexKnowledge(username, filename, chunkIndex, chunkContent) {
    const id = `${username}_knowledge_${filename}_${chunkIndex}`;
    const text = chunkContent;
    const metadata = { username, filename, chunkIndex };
    
    return this.addDocument('knowledge', id, text, metadata);
  }

  async deleteNote(username, noteId) {
    return this.deleteDocument('notes', `${username}_note_${noteId}`);
  }

  async deleteBlogPost(postId) {
    return this.deleteDocument('blog_posts', `blog_${postId}`);
  }

  async deleteKnowledge(username, filename, chunkIndex) {
    return this.deleteDocument('knowledge', `${username}_knowledge_${filename}_${chunkIndex}`);
  }

  // === HYBRID SEARCH ===
  
  async hybridSearch(query, options = {}) {
    const {
      searchNotes = true,
      searchBlogPosts = true,
      searchKnowledge = true,
      maxResults = 5
    } = options;

    const results = [];

    if (searchNotes) {
      const noteResults = await this.search('notes', query, { nResults: maxResults });
      if (noteResults.results) {
        results.push(...noteResults.results.map(r => ({ ...r, type: 'note' })));
      }
    }

    if (searchBlogPosts) {
      const blogResults = await this.search('blog_posts', query, { nResults: maxResults });
      if (blogResults.results) {
        results.push(...blogResults.results.map(r => ({ ...r, type: 'blog' })));
      }
    }

    if (searchKnowledge) {
      const knowledgeResults = await this.search('knowledge', query, { nResults: maxResults });
      if (knowledgeResults.results) {
        results.push(...knowledgeResults.results.map(r => ({ ...r, type: 'knowledge' })));
      }
    }

    // Sort by similarity and dedupe
    const seen = new Set();
    const uniqueResults = [];
    for (const result of results) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        uniqueResults.push(result);
      }
    }

    uniqueResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    return uniqueResults.slice(0, maxResults);
  }

  buildSemanticContext(searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return null;
    }

    let context = '=== RELEVANT KNOWLEDGE (Semantic Search) ===\n\n';
    
    for (const result of searchResults) {
      const similarityPercent = result.similarity 
        ? Math.round(result.similarity * 100) 
        : 'N/A';
      
      const typeEmoji = result.type === 'note' ? '📝' 
                      : result.type === 'blog' ? '📰' 
                      : '📚';
      
      context += `${typeEmoji} [${result.type.toUpperCase()}] Similarity: ${similarityPercent}%\n`;
      context += `${result.metadata?.title || result.id}\n`;
      context += `${result.content}\n`;
      context += '\n---\n\n';
    }

    return context;
  }
}

module.exports = new VectorService();
