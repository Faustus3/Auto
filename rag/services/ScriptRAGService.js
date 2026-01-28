// rag/services/ScriptRAGService.js

class ScriptRAGService {
  constructor(vectorStore, embeddingService, generationService) {
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    this.generationService = generationService;
  }

  async generateWithContext(query, contextType = 'script') {
    try {
      // Retrieve relevant context from vector store
      const contextResults = await this.vectorStore.query(query, this.config.retrieval.topK);
      
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
      .map((doc, index) => `Context ${index + 1}:
${doc}
`)
      .join('
');
    
    return `Use the following context to answer the question:

${contextText}

Question: ${query}

Provide a detailed and helpful answer:`;
  }

  async addScriptToKnowledgeBase(scriptId, scriptText) {
    try {
      const processed = await this.documentProcessor.processScript(scriptText);
      
      // Add each chunk to the vector store
      for (let i = 0; i < processed.chunks.length; i++) {
        const chunkId = `${scriptId}_chunk_${i}`;
        await this.vectorStore.addDocument(
          chunkId,
          processed.chunks[i],
          {
            ...processed.metadata,
            scriptId,
            chunkIndex: i
          }
        );
      }
      
      console.log(`✅ Script ${scriptId} added to knowledge base`);
    } catch (error) {
      console.error('❌ Failed to add script to knowledge base:', error);
      throw error;
    }
  }
}

export { ScriptRAGService };