// rag/services/ScriptRAGService.js

class ScriptRAGService {
  constructor(vectorStore, embeddingService, generationService) {
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    this.generationService = generationService;
  }

  async generateWithContext(query, contextType = 'script') {
    // Ensure vector store and embedding service are initialized
    if (!this.vectorStore.client || !this.embeddingService) {
        throw new Error('RAG services not fully initialized');
    }
    try {
      // Retrieve relevant context from vector store
      const contextResults = await this.vectorStore.query(query, 5);
      
      // Extract relevant documents
      const contextDocuments = contextResults.documents[0] || [];
      
      // Generate response using the context
      const prompt = this._buildPrompt(query, contextDocuments);
      
      const response = await this.generationService.generate({
        user: prompt,
        system: 'You are a helpful screenplay assistant.'
      });
      
      return {
        response,
        context: contextDocuments
      };
    } catch (error) {
      console.error('❌ RAG generation failed:', error);
      throw error;
    }
  }

  _buildPrompt(query, contextDocuments) {
    const contextText = contextDocuments
      .map((doc, index) => `Context ${index + 1}:\n${doc}\n`)
      .join('\n');
    
    return `Use the following context to answer the question:

${contextText}

Question: ${query}

Provide a detailed and helpful answer:`;
  }

  async addScriptToKnowledgeBase(scriptId, scriptText) {
    if (!scriptText) return;
    
    try {
        // Chunk the script for better retrieval if possible, 
        // but for now, we'll add it as a single document or simple chunks
        const chunks = [scriptText]; // Simple implementation
        
        for (let i = 0; i < chunks.length; i++) {
            await this.vectorStore.addDocument(`${scriptId}_${i}`, chunks[i], {
                type: 'script',
                source: scriptId,
                chunkIndex: i
            });
        }
        
        console.log(`✅ Script ${scriptId} indexed with ${chunks.length} chunks`);
    } catch (error) {
      console.error('❌ Failed to add script to knowledge base:', error);
      throw error;
    }
  }
}

export { ScriptRAGService };
