// rag/services/VectorStoreService.js

import { ChromaClient } from 'chromadb';

class VectorStoreService {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.collection = null;
  }

  async initialize() {
    try {
      this.client = new ChromaClient({
        path: this.config.vectorStore.path
      });
      
      // Create or get the collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.vectorStore.collection
      });
      
      console.log('✅ Vector Store initialized');
    } catch (error) {
      console.error('❌ Vector Store initialization failed:', error);
      throw error;
    }
  }

  async addDocument(documentId, text, metadata = {}) {
    try {
      const embedding = await this.generateEmbedding(text);
      
      await this.collection.add({
        ids: [documentId],
        embeddings: [embedding],
        documents: [text],
        metadatas: [metadata]
      });
      
      console.log(`✅ Document ${documentId} added to vector store`);
    } catch (error) {
      console.error('❌ Failed to add document:', error);
      throw error;
    }
  }

  async query(queryText, topK = 5) {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK
      });
      
      return results;
    } catch (error) {
      console.error('❌ Query failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    // Placeholder for embedding generation
    // In a real implementation, use a proper embedding model
    console.log('Generating embedding for:', text.substring(0, 50) + '...');
    return Array(this.config.embeddings.dimension).fill(0.1);
  }
}

export { VectorStoreService };